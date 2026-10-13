# LocalNote visual system

LocalNote uses a matte Windows workbench: a quiet navigation rail, a readable note canvas, and a restrained contents panel. The supplied eaworks v2 guidelines inform the flat construction and maker attribution; they do not impose a shared UI kit or a mandatory copper accent.

## Palette and typography

| Role | Light | Dark |
| --- | --- | --- |
| Canvas | `#F5F2ED` | `#0B0B0C` |
| Navigation | `#EEE9E2` | `#141415` |
| Note | `#FCFAF7` | `#1A1A1D` |
| Main text | `#2A241E` | `#E8DED3` |
| Secondary text | `#63594F` | `#BFB5AA` |
| Control border | `#8D8072` | `#84776B` |

Segoe UI Variable provides Windows-native text and titles; Cascadia/Consolas is reserved for code, paths, and shortcuts. All fonts are local system fonts. A 46rem note measure, compact sentence-case labels, and spacing communicate hierarchy. Controls use 4–8px radii; workspace panels use 10px radii. Surfaces have solid fills. Soft, neutral shadows separate workspace panels and floating windows, with stronger shadows for dialogs. Outer edges use a faint dark stroke rather than a bright outline; control boundaries and keyboard focus remain distinct. No blur, glow, or gradients are used.

Local Blue remains the default accent. Existing saved colors remain unchanged. Small accent labels and focus indicators use separate contrast-adjusted light/dark colors; filled controls keep the user's selected color and choose readable text. Semantic save, warning, and error states retain both text and color.

## Product artwork

The editable master is [`public/app-icon.svg`](../public/app-icon.svg), preserving the supplied 48×48 notebook geometry and ivory/copper/earth palette. It is shown directly in the interface. The maker credit appears only in About as `by ea.`. It is not stamped onto the icon or working navigation.

Regenerate distribution PNG/ICO/ICNS assets and NSIS bitmaps offline with:

```powershell
node scripts/generate-app-icons.mjs
```

The script uses the installed Tauri CLI, refreshes existing platform assets, adds 16/24/48/64px PNGs, updates the README PNG, and derives opaque installer artwork from the generated icon. No additional dependencies are required.

## Layout and interaction

Keep the three-region layout, resizable panels, collapsed navigation, narrow-window overlay, and focus mode. Dialogs and menus use opaque surfaces with soft shadow separation; modal scrims separate background content without blur. Neutral scrollbar colors are independent of higher-contrast control borders. Visible keyboard focus, Escape/focus restoration, readable save errors, and reduced motion remain part of the product system.

Navigation, the editor, and contents are separate panel islands, with 8px outer insets and 8px gaps on the quiet canvas. Each panel has a 10px corner radius, a faint dark edge, and a compact soft shadow. The editor scrolls inside its panel; empty/loading/error states occupy the same island. Resize handles sit in the gaps and calculate width from pointer movement rather than the window edge. Focus mode retains the inset editor island. Narrow-window navigation opens as an inset panel above the scrim.
