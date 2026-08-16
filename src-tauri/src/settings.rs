use crate::database::{self, DatabaseError, DatabaseState};
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};

const THEME_KEY: &str = "theme";
const SPELLCHECK_KEY: &str = "spellcheck";
const ACCENT_COLOR_KEY: &str = "accent_color";
pub(crate) const DEFAULT_ACCENT_COLOR: &str = "#4c1d95";

pub(crate) fn validate_hex_color(value: &str) -> Result<String, DatabaseError> {
    let trimmed = value.trim();
    let hex_part = trimmed.strip_prefix('#').ok_or_else(|| {
        DatabaseError::message(format!("Accent color '{value}' must start with '#'"))
    })?;

    if hex_part.len() == 6 && hex_part.chars().all(|c| c.is_ascii_hexdigit()) {
        Ok(format!("#{}", hex_part.to_ascii_lowercase()))
    } else if hex_part.len() == 3 && hex_part.chars().all(|c| c.is_ascii_hexdigit()) {
        let chars: Vec<char> = hex_part.chars().collect();
        Ok(format!(
            "#{}{}{}{}{}{}",
            chars[0].to_ascii_lowercase(),
            chars[0].to_ascii_lowercase(),
            chars[1].to_ascii_lowercase(),
            chars[1].to_ascii_lowercase(),
            chars[2].to_ascii_lowercase(),
            chars[2].to_ascii_lowercase()
        ))
    } else {
        Err(DatabaseError::message(format!(
            "Unsupported accent color '{value}'. Expected 3 or 6 hex digits."
        )))
    }
}

#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub(crate) enum ThemePreference {
    System,
    Light,
    Dark,
}

#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub(crate) enum SpellcheckPreference {
    System,
    Off,
}

impl SpellcheckPreference {
    fn as_str(self) -> &'static str {
        match self {
            Self::System => "system",
            Self::Off => "off",
        }
    }

    fn parse(value: &str) -> Result<Self, DatabaseError> {
        match value {
            "system" => Ok(Self::System),
            "off" => Ok(Self::Off),
            _ => Err(DatabaseError::message(format!(
                "Unsupported spellcheck preference '{value}'"
            ))),
        }
    }
}

impl ThemePreference {
    fn as_str(self) -> &'static str {
        match self {
            Self::System => "system",
            Self::Light => "light",
            Self::Dark => "dark",
        }
    }

    fn parse(value: &str) -> Result<Self, DatabaseError> {
        match value {
            "system" => Ok(Self::System),
            "light" => Ok(Self::Light),
            "dark" => Ok(Self::Dark),
            _ => Err(DatabaseError::message(format!(
                "Unsupported theme preference '{value}'"
            ))),
        }
    }
}

pub(crate) fn get_theme(state: &DatabaseState) -> Result<ThemePreference, DatabaseError> {
    let connection = database::connection(state)?;
    let stored = connection
        .query_row(
            "SELECT value FROM settings WHERE key = ?1",
            [THEME_KEY],
            |row| row.get::<_, String>(0),
        )
        .optional()?;

    stored
        .as_deref()
        .map(ThemePreference::parse)
        .transpose()
        .map(|preference| preference.unwrap_or(ThemePreference::System))
}

pub(crate) fn set_theme(
    state: &DatabaseState,
    preference: ThemePreference,
) -> Result<ThemePreference, DatabaseError> {
    let connection = database::connection(state)?;
    connection.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![THEME_KEY, preference.as_str()],
    )?;
    Ok(preference)
}

pub(crate) fn get_spellcheck(state: &DatabaseState) -> Result<SpellcheckPreference, DatabaseError> {
    let connection = database::connection(state)?;
    let stored = connection
        .query_row(
            "SELECT value FROM settings WHERE key = ?1",
            [SPELLCHECK_KEY],
            |row| row.get::<_, String>(0),
        )
        .optional()?;

    stored
        .as_deref()
        .map(SpellcheckPreference::parse)
        .transpose()
        .map(|preference| preference.unwrap_or(SpellcheckPreference::System))
}

pub(crate) fn set_spellcheck(
    state: &DatabaseState,
    preference: SpellcheckPreference,
) -> Result<SpellcheckPreference, DatabaseError> {
    let connection = database::connection(state)?;
    connection.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![SPELLCHECK_KEY, preference.as_str()],
    )?;
    Ok(preference)
}

pub(crate) fn get_accent_color(state: &DatabaseState) -> Result<String, DatabaseError> {
    let connection = database::connection(state)?;
    let stored = connection
        .query_row(
            "SELECT value FROM settings WHERE key = ?1",
            [ACCENT_COLOR_KEY],
            |row| row.get::<_, String>(0),
        )
        .optional()?;

    stored
        .as_deref()
        .map(validate_hex_color)
        .transpose()
        .map(|opt| opt.unwrap_or_else(|| DEFAULT_ACCENT_COLOR.to_string()))
}

pub(crate) fn set_accent_color(
    state: &DatabaseState,
    hex: &str,
) -> Result<String, DatabaseError> {
    let normalized = validate_hex_color(hex)?;
    let connection = database::connection(state)?;
    connection.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![ACCENT_COLOR_KEY, &normalized],
    )?;
    Ok(normalized)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn theme_defaults_to_system_and_persists_valid_preferences() {
        let directory = TempDir::new().unwrap();
        let state = database::initialize(directory.path()).unwrap();
        assert_eq!(get_theme(&state).unwrap(), ThemePreference::System);

        assert_eq!(
            set_theme(&state, ThemePreference::Dark).unwrap(),
            ThemePreference::Dark
        );
        let reopened = database::initialize(directory.path()).unwrap();
        assert_eq!(get_theme(&reopened).unwrap(), ThemePreference::Dark);
    }

    #[test]
    fn invalid_stored_theme_is_reported_instead_of_silently_applied() {
        let directory = TempDir::new().unwrap();
        let state = database::initialize(directory.path()).unwrap();
        let connection = database::connection(&state).unwrap();
        connection
            .execute(
                "INSERT INTO settings (key, value) VALUES (?1, ?2)",
                params![THEME_KEY, "sepia"],
            )
            .unwrap();

        assert!(get_theme(&state).is_err());
    }

    #[test]
    fn spellcheck_defaults_to_system_and_persists_valid_preferences() {
        let directory = TempDir::new().unwrap();
        let state = database::initialize(directory.path()).unwrap();
        assert_eq!(
            get_spellcheck(&state).unwrap(),
            SpellcheckPreference::System
        );

        assert_eq!(
            set_spellcheck(&state, SpellcheckPreference::Off).unwrap(),
            SpellcheckPreference::Off
        );
        let reopened = database::initialize(directory.path()).unwrap();
        assert_eq!(
            get_spellcheck(&reopened).unwrap(),
            SpellcheckPreference::Off
        );
    }

    #[test]
    fn invalid_stored_spellcheck_is_reported_instead_of_silently_applied() {
        let directory = TempDir::new().unwrap();
        let state = database::initialize(directory.path()).unwrap();
        let connection = database::connection(&state).unwrap();
        connection
            .execute(
                "INSERT INTO settings (key, value) VALUES (?1, ?2)",
                params![SPELLCHECK_KEY, "english"],
            )
            .unwrap();

        assert!(get_spellcheck(&state).is_err());
    }

    #[test]
    fn accent_color_defaults_and_persists_valid_hex() {
        let directory = TempDir::new().unwrap();
        let state = database::initialize(directory.path()).unwrap();
        assert_eq!(
            get_accent_color(&state).unwrap(),
            DEFAULT_ACCENT_COLOR
        );

        assert_eq!(
            set_accent_color(&state, "#14532D").unwrap(),
            "#14532d"
        );
        let reopened = database::initialize(directory.path()).unwrap();
        assert_eq!(get_accent_color(&reopened).unwrap(), "#14532d");

        // 3-character hex expansion
        assert_eq!(set_accent_color(&state, "#abc").unwrap(), "#aabbcc");
    }

    #[test]
    fn invalid_accent_color_is_rejected() {
        let directory = TempDir::new().unwrap();
        let state = database::initialize(directory.path()).unwrap();

        assert!(set_accent_color(&state, "not-a-color").is_err());
        assert!(set_accent_color(&state, "#12").is_err());
        assert!(set_accent_color(&state, "#gggggg").is_err());

        let connection = database::connection(&state).unwrap();
        connection
            .execute(
                "INSERT INTO settings (key, value) VALUES (?1, ?2)",
                params![ACCENT_COLOR_KEY, "invalid"],
            )
            .unwrap();

        assert!(get_accent_color(&state).is_err());
    }
}
