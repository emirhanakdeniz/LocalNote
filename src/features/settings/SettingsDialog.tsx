import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import type { BackupProgress, BackupStatus } from "../export/useNotesBackup";
import { ACCENT_PRESETS, isValidHex, normalizeHex } from "../theme/accent";
import type { ThemePreference } from "../theme/api";
import type { SpellcheckPreference } from "./api";

type SettingsDialogProps = {
  open: boolean;
  triggerRef: RefObject<HTMLButtonElement | null>;
  theme: ThemePreference;
  themeError: string | null;
  accentColor: string;
  accentColorError: string | null;
  spellcheck: SpellcheckPreference;
  spellcheckError: string | null;
  backupStatus: BackupStatus;
  backupProgress: BackupProgress;
  backupDestination: string | null;
  backupExportedCount: number;
  backupError: string | null;
  onThemeChange: (preference: ThemePreference) => void;
  onAccentColorChange: (hex: string) => void;
  onSpellcheckChange: (preference: SpellcheckPreference) => void;
  onStartBackup: () => void;
  onOpenBackupFolder: () => void;
  onResetBackup: () => void;
  onClose: () => void;
};

const themeOptions: Array<{ value: ThemePreference; label: string }> = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

const spellcheckOptions: Array<{ value: SpellcheckPreference; label: string }> = [
  { value: "system", label: "System" },
  { value: "off", label: "Off" },
];

export function SettingsDialog({
  open,
  triggerRef,
  theme,
  themeError,
  accentColor,
  accentColorError,
  spellcheck,
  spellcheckError,
  backupStatus,
  backupProgress,
  backupDestination,
  backupExportedCount,
  backupError,
  onThemeChange,
  onAccentColorChange,
  onSpellcheckChange,
  onStartBackup,
  onOpenBackupFolder,
  onResetBackup,
  onClose,
}: SettingsDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [hexInput, setHexInput] = useState(accentColor.toUpperCase());

  useEffect(() => {
    setHexInput(accentColor.toUpperCase());
  }, [accentColor]);

  useEffect(() => {
    if (!open) return;
    dialogRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        triggerRef.current?.focus();
      } else if (event.key === "Tab") {
        const focusable = Array.from(
          dialogRef.current?.querySelectorAll<HTMLElement>(
            'button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])',
          ) ?? [],
        );
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable.at(-1)!;
        const active = document.activeElement as HTMLElement | null;
        if (!active || !focusable.includes(active)) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus();
          return;
        }
        if (
          event.shiftKey &&
          document.activeElement === first
        ) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open, triggerRef]);

  if (!open) return null;

  const close = () => {
    onClose();
    triggerRef.current?.focus();
  };

  return (
    <div className="settings" onMouseDown={(event) => {
      if (event.target === event.currentTarget) close();
    }}>
      <div
        ref={dialogRef}
        className="settings__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        tabIndex={-1}
      >
        <header className="settings__header">
          <h1 id="settings-title">Settings</h1>
          <button type="button" aria-label="Close settings" onClick={close}>×</button>
        </header>

        <section className="settings__section" aria-labelledby="settings-appearance">
          <h2 id="settings-appearance">Appearance</h2>
          <fieldset>
            <legend>Theme</legend>
            <p className="settings__field-description">Choose how LocalNote looks.</p>
            <div className="settings__options">
              {themeOptions.map((option) => (
                <label key={option.value}>
                  <input
                    type="radio"
                    name="theme"
                    value={option.value}
                    checked={theme === option.value}
                    onChange={() => onThemeChange(option.value)}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          {themeError && <p className="settings__error" role="alert">{themeError}</p>}

          <fieldset className="settings__accent-fieldset">
            <legend>Accent Color</legend>
            <p className="settings__field-description">
              Choose a color for active highlights, buttons, and note accents.
            </p>
            <div className="settings__accent-presets" role="radiogroup" aria-label="Accent color presets">
              {ACCENT_PRESETS.map((preset) => {
                const isSelected = normalizeHex(accentColor) === normalizeHex(preset.hex);
                return (
                  <button
                    key={preset.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    aria-label={preset.name}
                    title={`${preset.name} (${preset.hex})`}
                    className={`settings__accent-swatch${isSelected ? " settings__accent-swatch--active" : ""}`}
                    style={{ "--swatch-color": preset.hex } as React.CSSProperties}
                    onClick={() => {
                      onAccentColorChange(preset.hex);
                      setHexInput(preset.hex.toUpperCase());
                    }}
                  >
                    {isSelected && (
                      <svg
                        className="settings__accent-check"
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          d="M3.5 8.5L6.5 11.5L12.5 4.5"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="settings__accent-custom">
              <label
                className="settings__accent-picker-button"
                title="Choose custom color with color picker"
              >
                <input
                  type="color"
                  value={isValidHex(accentColor) ? normalizeHex(accentColor) : "#4c1d95"}
                  onChange={(e) => {
                    onAccentColorChange(e.target.value);
                    setHexInput(e.target.value.toUpperCase());
                  }}
                  aria-label="Color picker"
                />
                <span
                  className="settings__accent-picker-preview"
                  style={{
                    backgroundColor: isValidHex(accentColor)
                      ? normalizeHex(accentColor)
                      : "#4c1d95",
                  }}
                />
              </label>
              <input
                type="text"
                className="settings__accent-hex-input"
                value={hexInput}
                placeholder="#4C1D95"
                maxLength={7}
                spellCheck={false}
                onChange={(e) => {
                  const val = e.target.value;
                  setHexInput(val.toUpperCase());
                  if (isValidHex(val)) {
                    onAccentColorChange(val);
                  }
                }}
                onBlur={() => {
                  if (!isValidHex(hexInput)) {
                    setHexInput(accentColor.toUpperCase());
                  } else {
                    setHexInput(normalizeHex(hexInput).toUpperCase());
                  }
                }}
                aria-label="Custom hex color code"
              />
            </div>
          </fieldset>
          {accentColorError && <p className="settings__error" role="alert">{accentColorError}</p>}
        </section>

        <section className="settings__section" aria-labelledby="settings-editor">
          <h2 id="settings-editor">Editor</h2>
          <fieldset>
            <legend>Spellcheck</legend>
            <p className="settings__field-description">
              Use the local system spellchecker or turn it off.
            </p>
            <div className="settings__options">
              {spellcheckOptions.map((option) => (
                <label key={option.value}>
                  <input
                    type="radio"
                    name="spellcheck"
                    value={option.value}
                    checked={spellcheck === option.value}
                    onChange={() => onSpellcheckChange(option.value)}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          {spellcheckError && <p className="settings__error" role="alert">{spellcheckError}</p>}
        </section>

        <section className="settings__section" aria-labelledby="settings-backup">
          <h2 id="settings-backup">Backup</h2>
          <p className="settings__field-description">
            Export all your notes as Markdown files into the <code>Documents/LocalNote Notes</code> folder.
          </p>

          {backupStatus === "idle" && (
            <div className="settings__backup-action">
              <button
                type="button"
                className="settings__button settings__button--primary"
                onClick={onStartBackup}
              >
                <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M8 2v8M4.5 7.5L8 11l3.5-3.5M2.5 13.5h11" />
                </svg>
                <span>Backup all notes</span>
              </button>
            </div>
          )}

          {backupStatus === "in_progress" && (
            <div className="settings__backup-progress" role="status" aria-live="polite">
              <div className="settings__backup-progress-header">
                <span className="settings__backup-spinner" aria-hidden="true" />
                <div className="settings__backup-progress-text">
                  <strong>
                    {backupProgress.total > 0
                      ? `Exporting note ${backupProgress.current} of ${backupProgress.total}…`
                      : "Preparing backup…"}
                  </strong>
                  <span className="settings__backup-note-title" title={backupProgress.noteTitle}>
                    {backupProgress.noteTitle}
                  </span>
                </div>
              </div>
              <div
                className="settings__progress-bar"
                role="progressbar"
                aria-valuenow={backupProgress.total > 0 ? Math.round((backupProgress.current / backupProgress.total) * 100) : 0}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="settings__progress-fill"
                  style={{
                    width: `${backupProgress.total > 0 ? Math.max(5, Math.round((backupProgress.current / backupProgress.total) * 100)) : 10}%`,
                  }}
                />
              </div>
            </div>
          )}

          {backupStatus === "success" && (
            <div className="settings__backup-success" role="status" aria-live="polite">
              <div className="settings__backup-success-header">
                <div className="settings__backup-success-icon" aria-hidden="true">
                  <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3.5 8.5L6.5 11.5L12.5 4.5" />
                  </svg>
                </div>
                <div className="settings__backup-success-details">
                  <strong>Backup complete!</strong>
                  <p>
                    {backupExportedCount} {backupExportedCount === 1 ? "note" : "notes"} exported to:
                  </p>
                  {backupDestination && (
                    <code className="settings__backup-path" title={backupDestination}>
                      {backupDestination}
                    </code>
                  )}
                </div>
              </div>
              <div className="settings__backup-success-actions">
                <button
                  type="button"
                  className="settings__button settings__button--primary"
                  onClick={onOpenBackupFolder}
                >
                  <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M1.5 3.5h4l1.5 2h7.5v8H1.5z" />
                  </svg>
                  <span>Open Folder</span>
                </button>
                <button
                  type="button"
                  className="settings__button settings__button--secondary"
                  onClick={onResetBackup}
                >
                  Backup Again
                </button>
              </div>
            </div>
          )}

          {backupStatus === "error" && (
            <div className="settings__backup-error" role="alert">
              <p className="settings__error">{backupError}</p>
              <button
                type="button"
                className="settings__button settings__button--primary"
                onClick={onStartBackup}
              >
                Retry Backup
              </button>
            </div>
          )}
        </section>

        <section className="settings__section settings__about" aria-labelledby="settings-about">
          <h2 id="settings-about">About</h2>
          <div className="settings__about-product">
            <img src="/app-icon.png" alt="" />
            <div>
              <strong>LocalNote</strong>
              <span>Version 1.0.2</span>
            </div>
          </div>
          <p>Fast, private notes stored only on this device. No account or cloud service.</p>
        </section>
      </div>
    </div>
  );
}
