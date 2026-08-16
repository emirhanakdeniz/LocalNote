use crate::database::{self, DatabaseError, DatabaseState};
use crate::search;
use rusqlite::{params, Connection, OptionalExtension, Row, Transaction};
use serde::Serialize;
use uuid::Uuid;

const DEFAULT_TITLE: &str = "Untitled";
const MAX_TITLE_LENGTH: usize = 200;
const UTC_NOW_SQL: &str = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Page {
    pub(crate) id: String,
    pub(crate) title: String,
    pub(crate) parent_id: Option<String>,
    pub(crate) position: i64,
    pub(crate) is_favorite: bool,
    pub(crate) created_at: String,
    pub(crate) updated_at: String,
    pub(crate) last_opened_at: Option<String>,
    pub(crate) deleted_at: Option<String>,
}

pub(crate) fn list(state: &DatabaseState) -> Result<Vec<Page>, DatabaseError> {
    let connection = database::connection(state)?;
    list_with_connection(&connection)
}

pub(crate) fn create(
    state: &DatabaseState,
    parent_id: Option<String>,
) -> Result<Page, DatabaseError> {
    let mut connection = database::connection(state)?;
    let transaction = connection.transaction()?;
    validate_parent(&transaction, parent_id.as_deref())?;

    let position = i64::try_from(sibling_ids(&transaction, parent_id.as_deref(), None)?.len())
        .map_err(|error| DatabaseError::context("Sibling position is too large", error))?;
    let id = Uuid::new_v4().to_string();
    transaction.execute(
        &format!(
            "INSERT INTO pages
             (id, title, parent_id, position, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, {UTC_NOW_SQL}, {UTC_NOW_SQL})"
        ),
        params![id, DEFAULT_TITLE, parent_id, position],
    )?;
    search::insert_page(&transaction, &id, DEFAULT_TITLE, "")?;
    transaction.commit()?;

    get(&connection, &id)
}

pub(crate) fn rename(
    state: &DatabaseState,
    id: &str,
    requested_title: &str,
) -> Result<Page, DatabaseError> {
    validate_id(id)?;
    let title = normalized_title(requested_title)?;
    let mut connection = database::connection(state)?;
    let transaction = connection.transaction()?;
    let changed = transaction.execute(
        &format!("UPDATE pages SET title = ?1, updated_at = {UTC_NOW_SQL} WHERE id = ?2"),
        params![&title, id],
    )?;
    ensure_changed(changed, id)?;
    search::update_title(&transaction, id, &title)?;
    transaction.commit()?;
    get(&connection, id)
}

pub(crate) fn open(state: &DatabaseState, id: &str) -> Result<Page, DatabaseError> {
    validate_id(id)?;
    let connection = database::connection(state)?;
    let changed = connection.execute(
        &format!(
            "UPDATE pages
             SET last_opened_at = {UTC_NOW_SQL}, updated_at = updated_at
             WHERE id = ?1"
        ),
        [id],
    )?;
    ensure_changed(changed, id)?;
    get(&connection, id)
}

pub(crate) fn set_favorite(
    state: &DatabaseState,
    id: &str,
    is_favorite: bool,
) -> Result<Page, DatabaseError> {
    validate_id(id)?;
    let connection = database::connection(state)?;
    let changed = connection.execute(
        &format!(
            "UPDATE pages
             SET is_favorite = ?1, updated_at = {UTC_NOW_SQL}
             WHERE id = ?2"
        ),
        params![is_favorite, id],
    )?;
    ensure_changed(changed, id)?;
    get(&connection, id)
}

pub(crate) fn move_page(
    state: &DatabaseState,
    id: &str,
    new_parent_id: Option<String>,
    requested_position: usize,
) -> Result<Vec<Page>, DatabaseError> {
    validate_id(id)?;
    let mut connection = database::connection(state)?;
    let transaction = connection.transaction()?;
    let page = get(&transaction, id)?;
    validate_parent(&transaction, new_parent_id.as_deref())?;
    validate_move(&transaction, id, new_parent_id.as_deref())?;

    if page.parent_id == new_parent_id {
        let mut siblings = sibling_ids(&transaction, page.parent_id.as_deref(), Some(id))?;
        let position = requested_position.min(siblings.len());
        siblings.insert(position, id.to_owned());
        assign_siblings(&transaction, page.parent_id.as_deref(), &siblings)?;
    } else {
        let previous_siblings = sibling_ids(&transaction, page.parent_id.as_deref(), Some(id))?;
        assign_siblings(&transaction, page.parent_id.as_deref(), &previous_siblings)?;

        let mut new_siblings = sibling_ids(&transaction, new_parent_id.as_deref(), None)?;
        let position = requested_position.min(new_siblings.len());
        new_siblings.insert(position, id.to_owned());
        assign_siblings(&transaction, new_parent_id.as_deref(), &new_siblings)?;
    }

    transaction.execute(
        &format!("UPDATE pages SET updated_at = {UTC_NOW_SQL} WHERE id = ?1"),
        [id],
    )?;
    transaction.commit()?;
    list_with_connection(&connection)
}

pub(crate) fn delete(state: &DatabaseState, id: &str) -> Result<Vec<Page>, DatabaseError> {
    validate_id(id)?;
    let mut connection = database::connection(state)?;
    let transaction = connection.transaction()?;
    let page = get(&transaction, id)?;
    let children = sibling_ids(&transaction, Some(id), None)?;
    let mut parent_siblings = sibling_ids(&transaction, page.parent_id.as_deref(), Some(id))?;
    let page_position = usize::try_from(page.position)
        .map_err(|error| DatabaseError::context("Stored page position is invalid", error))?;
    let insertion_point = page_position.min(parent_siblings.len());

    transaction.execute(
        &format!(
            "UPDATE pages
             SET parent_id = ?1, updated_at = {UTC_NOW_SQL}
             WHERE parent_id = ?2"
        ),
        params![page.parent_id, id],
    )?;

    search::delete_page(&transaction, id)?;
    transaction.execute(
        &format!(
            "UPDATE pages
             SET deleted_at = {UTC_NOW_SQL}, updated_at = {UTC_NOW_SQL}
             WHERE id = ?1"
        ),
        [id],
    )?;
    parent_siblings.splice(insertion_point..insertion_point, children);
    assign_siblings(&transaction, page.parent_id.as_deref(), &parent_siblings)?;
    transaction.commit()?;
    list_with_connection(&connection)
}

pub(crate) fn list_trash(state: &DatabaseState) -> Result<Vec<Page>, DatabaseError> {
    let connection = database::connection(state)?;
    let mut statement = connection.prepare(
        "SELECT id, title, parent_id, position, is_favorite,
                created_at, updated_at, last_opened_at, deleted_at
         FROM pages
         WHERE deleted_at IS NOT NULL
         ORDER BY deleted_at DESC, id",
    )?;
    let pages = statement
        .query_map([], page_from_row)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(DatabaseError::from)?;
    Ok(pages)
}

pub(crate) fn restore(state: &DatabaseState, id: &str) -> Result<Vec<Page>, DatabaseError> {
    validate_id(id)?;
    let mut connection = database::connection(state)?;
    let transaction = connection.transaction()?;
    let page = get(&transaction, id)?;
    if page.deleted_at.is_none() {
        return list_with_connection(&transaction);
    }

    // Check if original parent is still active
    let parent_id = match page.parent_id.as_deref() {
        Some(parent_id) => {
            let parent_active: bool = transaction
                .query_row(
                    "SELECT 1 FROM pages WHERE id = ?1 AND deleted_at IS NULL",
                    [parent_id],
                    |_| Ok(true),
                )
                .optional()?
                .unwrap_or(false);
            if parent_active {
                Some(parent_id.to_string())
            } else {
                None
            }
        }
        None => None,
    };

    let siblings = sibling_ids(&transaction, parent_id.as_deref(), Some(id))?;
    let new_position = i64::try_from(siblings.len())
        .map_err(|error| DatabaseError::context("Sibling position is too large", error))?;

    transaction.execute(
        &format!(
            "UPDATE pages
             SET deleted_at = NULL, parent_id = ?1, position = ?2, updated_at = {UTC_NOW_SQL}
             WHERE id = ?3"
        ),
        params![parent_id, new_position, id],
    )?;

    let body: String = transaction
        .query_row(
            "SELECT content_json FROM documents WHERE page_id = ?1",
            [id],
            |row| row.get::<_, String>(0),
        )
        .optional()?
        .and_then(|json| search::extract_document_text(&json).ok())
        .unwrap_or_default();

    search::delete_page(&transaction, id)?;
    search::insert_page(&transaction, id, &page.title, &body)?;

    transaction.commit()?;
    list_with_connection(&connection)
}

pub(crate) fn delete_permanently(
    state: &DatabaseState,
    id: &str,
) -> Result<Vec<Page>, DatabaseError> {
    validate_id(id)?;
    let mut connection = database::connection(state)?;
    let transaction = connection.transaction()?;
    let page = get(&transaction, id)?;
    transaction.execute(
        &format!(
            "UPDATE pages
             SET parent_id = ?1, updated_at = {UTC_NOW_SQL}
             WHERE parent_id = ?2"
        ),
        params![page.parent_id, id],
    )?;
    search::delete_page(&transaction, id)?;
    transaction.execute("DELETE FROM documents WHERE page_id = ?1", [id])?;
    transaction.execute("DELETE FROM pages WHERE id = ?1", [id])?;
    transaction.commit()?;
    list_trash(state)
}

pub(crate) fn empty_trash(state: &DatabaseState) -> Result<(), DatabaseError> {
    let mut connection = database::connection(state)?;
    let transaction = connection.transaction()?;
    let mut statement = transaction.prepare("SELECT id, parent_id FROM pages WHERE deleted_at IS NOT NULL")?;
    let trashed_pages: Vec<(String, Option<String>)> = statement
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(DatabaseError::from)?;
    drop(statement);

    for (id, parent_id) in &trashed_pages {
        transaction.execute(
            &format!(
                "UPDATE pages
                 SET parent_id = ?1, updated_at = {UTC_NOW_SQL}
                 WHERE parent_id = ?2"
            ),
            params![parent_id, id],
        )?;
        search::delete_page(&transaction, id)?;
        transaction.execute("DELETE FROM documents WHERE page_id = ?1", [id])?;
        transaction.execute("DELETE FROM pages WHERE id = ?1", [id])?;
    }
    transaction.commit()?;
    Ok(())
}

fn list_with_connection(connection: &Connection) -> Result<Vec<Page>, DatabaseError> {
    let mut statement = connection.prepare(
        "SELECT id, title, parent_id, position, is_favorite,
                created_at, updated_at, last_opened_at, deleted_at
         FROM pages
         WHERE deleted_at IS NULL
         ORDER BY parent_id IS NOT NULL, parent_id, position, created_at, id",
    )?;
    let pages = statement
        .query_map([], page_from_row)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(DatabaseError::from)?;
    Ok(pages)
}

fn get(connection: &Connection, id: &str) -> Result<Page, DatabaseError> {
    connection
        .query_row(
            "SELECT id, title, parent_id, position, is_favorite,
                    created_at, updated_at, last_opened_at, deleted_at
             FROM pages WHERE id = ?1",
            [id],
            page_from_row,
        )
        .optional()?
        .ok_or_else(|| DatabaseError::message(format!("Page '{id}' does not exist")))
}

fn page_from_row(row: &Row<'_>) -> rusqlite::Result<Page> {
    Ok(Page {
        id: row.get(0)?,
        title: row.get(1)?,
        parent_id: row.get(2)?,
        position: row.get(3)?,
        is_favorite: row.get(4)?,
        created_at: row.get(5)?,
        updated_at: row.get(6)?,
        last_opened_at: row.get(7)?,
        deleted_at: row.get(8)?,
    })
}

fn sibling_ids(
    connection: &Connection,
    parent_id: Option<&str>,
    excluded_id: Option<&str>,
) -> Result<Vec<String>, DatabaseError> {
    let mut statement = connection.prepare(
        "SELECT id FROM pages
         WHERE parent_id IS ?1 AND (?2 IS NULL OR id <> ?2) AND deleted_at IS NULL
         ORDER BY position, created_at, id",
    )?;
    let ids = statement
        .query_map(params![parent_id, excluded_id], |row| row.get(0))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(DatabaseError::from)?;
    Ok(ids)
}

fn assign_siblings(
    transaction: &Transaction<'_>,
    parent_id: Option<&str>,
    ids: &[String],
) -> Result<(), DatabaseError> {
    for (position, id) in ids.iter().enumerate() {
        let position = i64::try_from(position)
            .map_err(|error| DatabaseError::context("Sibling position is too large", error))?;
        transaction.execute(
            "UPDATE pages SET parent_id = ?1, position = ?2 WHERE id = ?3",
            params![parent_id, position, id],
        )?;
    }
    Ok(())
}

fn validate_parent(connection: &Connection, parent_id: Option<&str>) -> Result<(), DatabaseError> {
    if let Some(parent_id) = parent_id {
        validate_id(parent_id)?;
        get(connection, parent_id)?;
    }
    Ok(())
}

fn validate_move(
    connection: &Connection,
    id: &str,
    new_parent_id: Option<&str>,
) -> Result<(), DatabaseError> {
    let Some(new_parent_id) = new_parent_id else {
        return Ok(());
    };
    if id == new_parent_id {
        return Err(DatabaseError::message("A page cannot be its own parent"));
    }

    let creates_cycle: bool = connection.query_row(
        "WITH RECURSIVE descendants(id) AS (
             SELECT id FROM pages WHERE parent_id = ?1
             UNION ALL
             SELECT pages.id FROM pages JOIN descendants ON pages.parent_id = descendants.id
         )
         SELECT EXISTS(SELECT 1 FROM descendants WHERE id = ?2)",
        params![id, new_parent_id],
        |row| row.get(0),
    )?;
    if creates_cycle {
        return Err(DatabaseError::message(
            "A page cannot be moved into one of its descendants",
        ));
    }
    Ok(())
}

fn normalized_title(requested_title: &str) -> Result<String, DatabaseError> {
    let title = requested_title.trim();
    if title.chars().count() > MAX_TITLE_LENGTH {
        return Err(DatabaseError::message(format!(
            "Page titles cannot exceed {MAX_TITLE_LENGTH} characters"
        )));
    }
    Ok(if title.is_empty() {
        DEFAULT_TITLE.to_owned()
    } else {
        title.to_owned()
    })
}

fn validate_id(id: &str) -> Result<(), DatabaseError> {
    if id.trim().is_empty() {
        return Err(DatabaseError::message("Page ID cannot be empty"));
    }
    Ok(())
}

fn ensure_changed(changed: usize, id: &str) -> Result<(), DatabaseError> {
    if changed == 0 {
        return Err(DatabaseError::message(format!(
            "Page '{id}' does not exist"
        )));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn page_database() -> (TempDir, DatabaseState) {
        let directory = TempDir::new().expect("temporary directory should be created");
        let state = database::initialize(directory.path()).expect("database should initialize");
        (directory, state)
    }

    fn titles(pages: &[Page]) -> Vec<&str> {
        pages.iter().map(|page| page.title.as_str()).collect()
    }

    #[test]
    fn creates_root_and_child_pages_in_deterministic_order() {
        let (directory, state) = page_database();
        let first = create(&state, None).unwrap();
        rename(&state, &first.id, "First").unwrap();
        let second = create(&state, None).unwrap();
        rename(&state, &second.id, "Second").unwrap();
        let child = create(&state, Some(first.id.clone())).unwrap();
        rename(&state, &child.id, "Child").unwrap();

        let pages = list(&state).unwrap();
        assert_eq!(titles(&pages), ["First", "Second", "Child"]);
        assert_eq!(pages[0].position, 0);
        assert_eq!(pages[1].position, 1);
        assert_eq!(pages[2].parent_id.as_deref(), Some(first.id.as_str()));
        assert!(pages[0].created_at.contains('T'));
        assert!(pages[0].created_at.ends_with('Z'));

        let reopened = database::initialize(directory.path()).unwrap();
        assert_eq!(list(&reopened).unwrap(), pages);
    }

    #[test]
    fn renames_pages_and_normalizes_blank_titles() {
        let (_directory, state) = page_database();
        let page = create(&state, None).unwrap();

        assert_eq!(
            rename(&state, &page.id, "  Notes  ").unwrap().title,
            "Notes"
        );
        assert_eq!(
            rename(&state, &page.id, "   ").unwrap().title,
            DEFAULT_TITLE
        );
    }

    #[test]
    fn reorders_siblings_and_keeps_positions_contiguous() {
        let (_directory, state) = page_database();
        let first = create(&state, None).unwrap();
        let second = create(&state, None).unwrap();
        let third = create(&state, None).unwrap();
        rename(&state, &first.id, "First").unwrap();
        rename(&state, &second.id, "Second").unwrap();
        rename(&state, &third.id, "Third").unwrap();

        let pages = move_page(&state, &third.id, None, 0).unwrap();
        assert_eq!(titles(&pages), ["Third", "First", "Second"]);
        assert_eq!(
            pages.iter().map(|page| page.position).collect::<Vec<_>>(),
            [0, 1, 2]
        );
    }

    #[test]
    fn reparents_pages_and_rejects_hierarchy_cycles() {
        let (_directory, state) = page_database();
        let parent = create(&state, None).unwrap();
        let child = create(&state, Some(parent.id.clone())).unwrap();
        let grandchild = create(&state, Some(child.id.clone())).unwrap();
        let other_parent = create(&state, None).unwrap();

        assert!(move_page(&state, &parent.id, Some(grandchild.id.clone()), 0).is_err());
        assert!(move_page(&state, &parent.id, Some(parent.id.clone()), 0).is_err());

        let pages = move_page(&state, &child.id, Some(other_parent.id.clone()), 0).unwrap();
        let moved = pages.iter().find(|page| page.id == child.id).unwrap();
        let nested = pages.iter().find(|page| page.id == grandchild.id).unwrap();
        assert_eq!(moved.parent_id.as_deref(), Some(other_parent.id.as_str()));
        assert_eq!(nested.parent_id.as_deref(), Some(child.id.as_str()));
    }

    #[test]
    fn deletes_leaf_pages_and_normalizes_positions() {
        let (_directory, state) = page_database();
        let first = create(&state, None).unwrap();
        let second = create(&state, None).unwrap();
        let third = create(&state, None).unwrap();

        let pages = delete(&state, &second.id).unwrap();
        assert_eq!(pages.len(), 2);
        assert_eq!(pages[0].id, first.id);
        assert_eq!(pages[1].id, third.id);
        assert_eq!(pages[1].position, 1);
    }

    #[test]
    fn deleting_a_parent_promotes_children_at_its_position() {
        let (_directory, state) = page_database();
        let before = create(&state, None).unwrap();
        rename(&state, &before.id, "Before").unwrap();
        let parent = create(&state, None).unwrap();
        rename(&state, &parent.id, "Parent").unwrap();
        let after = create(&state, None).unwrap();
        rename(&state, &after.id, "After").unwrap();
        let first_child = create(&state, Some(parent.id.clone())).unwrap();
        rename(&state, &first_child.id, "Child A").unwrap();
        let second_child = create(&state, Some(parent.id.clone())).unwrap();
        rename(&state, &second_child.id, "Child B").unwrap();

        let pages = delete(&state, &parent.id).unwrap();
        assert_eq!(titles(&pages), ["Before", "Child A", "Child B", "After"]);
        assert!(pages.iter().all(|page| page.parent_id.is_none()));
        assert_eq!(
            pages.iter().map(|page| page.position).collect::<Vec<_>>(),
            [0, 1, 2, 3]
        );
    }

    #[test]
    fn opening_a_page_persistently_records_utc_metadata() {
        let (_directory, state) = page_database();
        let page = create(&state, None).unwrap();
        let opened = open(&state, &page.id).unwrap();
        let timestamp = opened.last_opened_at.unwrap();

        assert!(timestamp.contains('T'));
        assert!(timestamp.ends_with('Z'));
    }

    #[test]
    fn favorite_toggle_persists_across_reopened_connections() {
        let (directory, state) = page_database();
        let page = create(&state, None).unwrap();

        assert!(set_favorite(&state, &page.id, true).unwrap().is_favorite);
        let reopened = database::initialize(directory.path()).unwrap();
        assert!(list(&reopened).unwrap()[0].is_favorite);
        assert!(
            !set_favorite(&reopened, &page.id, false)
                .unwrap()
                .is_favorite
        );
        assert!(!list(&reopened).unwrap()[0].is_favorite);
    }

    #[test]
    fn unopened_pages_have_no_recent_metadata_and_deletion_removes_favorite_recent_pages() {
        let (_directory, state) = page_database();
        let opened = create(&state, None).unwrap();
        let unopened = create(&state, None).unwrap();
        set_favorite(&state, &opened.id, true).unwrap();
        open(&state, &opened.id).unwrap();

        let pages = list(&state).unwrap();
        assert!(pages
            .iter()
            .find(|page| page.id == opened.id)
            .unwrap()
            .last_opened_at
            .is_some());
        assert!(pages
            .iter()
            .find(|page| page.id == unopened.id)
            .unwrap()
            .last_opened_at
            .is_none());

        let remaining = delete(&state, &opened.id).unwrap();
        assert!(remaining.iter().all(|page| page.id != opened.id));
        assert!(remaining.iter().all(|page| !page.is_favorite));
        assert!(remaining.iter().all(|page| page.last_opened_at.is_none()));
    }

    #[test]
    fn trash_and_list_trash_separates_active_and_trashed_pages() {
        let (_directory, state) = page_database();
        let page_a = create(&state, None).unwrap();
        rename(&state, &page_a.id, "Note A").unwrap();
        let page_b = create(&state, None).unwrap();
        rename(&state, &page_b.id, "Note B").unwrap();

        assert_eq!(list_trash(&state).unwrap().len(), 0);

        let active_after_delete = delete(&state, &page_a.id).unwrap();
        assert_eq!(active_after_delete.len(), 1);
        assert_eq!(active_after_delete[0].id, page_b.id);

        let trash = list_trash(&state).unwrap();
        assert_eq!(trash.len(), 1);
        assert_eq!(trash[0].id, page_a.id);
        assert!(trash[0].deleted_at.is_some());
    }

    #[test]
    fn restore_trashed_page_returns_to_active_pages_and_reindexes_search() {
        let (_directory, state) = page_database();
        let page = create(&state, None).unwrap();
        rename(&state, &page.id, "Important Note").unwrap();
        crate::documents::save(
            &state,
            &page.id,
            r#"[{"type":"paragraph","content":[{"type":"text","text":"searchable text","styles":{}}]}]"#,
        )
        .unwrap();

        assert_eq!(search::search(&state, "searchable").unwrap().len(), 1);

        // Trash it
        delete(&state, &page.id).unwrap();
        assert_eq!(search::search(&state, "searchable").unwrap().len(), 0);
        assert_eq!(list(&state).unwrap().len(), 0);

        // Restore it
        let active = restore(&state, &page.id).unwrap();
        assert_eq!(active.len(), 1);
        assert_eq!(active[0].id, page.id);
        assert!(active[0].deleted_at.is_none());

        assert_eq!(search::search(&state, "searchable").unwrap().len(), 1);
        assert_eq!(list_trash(&state).unwrap().len(), 0);
    }

    #[test]
    fn restore_orphaned_page_moves_to_root() {
        let (_directory, state) = page_database();
        let parent = create(&state, None).unwrap();
        let child = create(&state, Some(parent.id.clone())).unwrap();

        // Move child to trash first
        delete(&state, &child.id).unwrap();
        // Delete parent permanently
        delete(&state, &parent.id).unwrap();
        delete_permanently(&state, &parent.id).unwrap();

        // Restore child - parent no longer exists so child should become top-level
        let active = restore(&state, &child.id).unwrap();
        assert_eq!(active.len(), 1);
        assert_eq!(active[0].id, child.id);
        assert_eq!(active[0].parent_id, None);
    }

    #[test]
    fn delete_permanently_and_empty_trash_removes_from_sqlite() {
        let (_directory, state) = page_database();
        let page_a = create(&state, None).unwrap();
        let page_b = create(&state, None).unwrap();

        delete(&state, &page_a.id).unwrap();
        delete(&state, &page_b.id).unwrap();
        assert_eq!(list_trash(&state).unwrap().len(), 2);

        delete_permanently(&state, &page_a.id).unwrap();
        let remaining_trash = list_trash(&state).unwrap();
        assert_eq!(remaining_trash.len(), 1);
        assert_eq!(remaining_trash[0].id, page_b.id);

        empty_trash(&state).unwrap();
        assert_eq!(list_trash(&state).unwrap().len(), 0);
    }

    #[test]
    fn deep_hierarchy_and_multilevel_child_promotion() {
        let (_directory, state) = page_database();

        // Build a 5-level deep hierarchy: Level1 -> Level2 -> Level3 -> Level4 -> Level5
        let l1 = create(&state, None).unwrap();
        rename(&state, &l1.id, "Level 1").unwrap();
        let l2 = create(&state, Some(l1.id.clone())).unwrap();
        rename(&state, &l2.id, "Level 2").unwrap();
        let l3 = create(&state, Some(l2.id.clone())).unwrap();
        rename(&state, &l3.id, "Level 3").unwrap();
        let l4 = create(&state, Some(l3.id.clone())).unwrap();
        rename(&state, &l4.id, "Level 4").unwrap();
        let l5 = create(&state, Some(l4.id.clone())).unwrap();
        rename(&state, &l5.id, "Level 5").unwrap();

        assert_eq!(list(&state).unwrap().len(), 5);

        // Deleting Level 2 should promote Level 3 to become child of Level 1 (Level 2's parent)
        let after_l2_delete = delete(&state, &l2.id).unwrap();
        assert_eq!(after_l2_delete.len(), 4);

        let promoted_l3 = after_l2_delete.iter().find(|p| p.id == l3.id).unwrap();
        assert_eq!(promoted_l3.parent_id.as_deref(), Some(l1.id.as_str()));

        let l4_check = after_l2_delete.iter().find(|p| p.id == l4.id).unwrap();
        assert_eq!(l4_check.parent_id.as_deref(), Some(l3.id.as_str()));

        // Deleting Level 1 (root) should promote Level 3 to root level
        let after_l1_delete = delete(&state, &l1.id).unwrap();
        assert_eq!(after_l1_delete.len(), 3);

        let root_l3 = after_l1_delete.iter().find(|p| p.id == l3.id).unwrap();
        assert_eq!(root_l3.parent_id, None);
    }

    #[test]
    fn sibling_reordering_at_boundary_extremities() {
        let (_directory, state) = page_database();
        let p0 = create(&state, None).unwrap();
        let p1 = create(&state, None).unwrap();
        let p2 = create(&state, None).unwrap();

        // Move p0 beyond the end (position 999) -> clamps to position 2
        let reordered = move_page(&state, &p0.id, None, 999).unwrap();
        assert_eq!(reordered[0].id, p1.id);
        assert_eq!(reordered[0].position, 0);
        assert_eq!(reordered[1].id, p2.id);
        assert_eq!(reordered[1].position, 1);
        assert_eq!(reordered[2].id, p0.id);
        assert_eq!(reordered[2].position, 2);

        // Move p0 back to 0
        let reordered_back = move_page(&state, &p0.id, None, 0).unwrap();
        assert_eq!(reordered_back[0].id, p0.id);
        assert_eq!(reordered_back[0].position, 0);
    }

    #[test]
    fn unicode_and_special_character_titles() {
        let (_directory, state) = page_database();
        let p = create(&state, None).unwrap();
        let complex_title = "🚀 Proje Notları — Türkçe & 日本語 (2026/V1) #1";
        let renamed = rename(&state, &p.id, complex_title).unwrap();
        assert_eq!(renamed.title, complex_title);

        let listed = list(&state).unwrap();
        assert_eq!(listed[0].title, complex_title);
    }
}
