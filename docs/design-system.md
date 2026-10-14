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

Segoe UI Variable provides Windows-native text and titles; Cascadia/Consolas is reserved for code, paths, and shortcuts. All fonts are local system fonts. A 46rem note measure, compact sentence-case labels, and spacing communicate hierarchy. Controls use 4–8px radii; workspace panels use 10px radii. Surfaces have solid, opaque fills. The existing warm light palette and Charcoal/Graphite/Warm Ivory dark palette are preserved. Spacing and flat surface differences do most of the separation; compact dark shadows only clarify panel, menu, dialog, and control boundaries. There are no bright outlines, illuminated inner shadows, glass surfaces, or gradients. Keyboard focus retains a clear outline.

Local Blue remains the default accent. Existing saved colors remain unchanged; Copper is not imposed as an application accent. Small accent labels and focus indicators use separate contrast-adjusted light/dark colors. Accent tints identify selected controls and actions; ordinary buttons, inline code, and favorite markers use the product's neutral palette. Semantic save, warning, and error states retain both text and color.

## Product artwork

The editable master is [`public/app-icon.svg`](../public/app-icon.svg), preserving the supplied 48×48 notebook geometry and ivory/copper/earth palette. It is shown directly in the interface. The maker credit appears in the Settings footer as `by ea.`. It is not stamped onto the icon or working navigation.

Regenerate distribution PNG/ICO/ICNS assets and NSIS bitmaps offline with:

```powershell
node scripts/generate-app-icons.mjs
```

The script uses the installed Tauri CLI, refreshes existing platform assets, adds 16/24/48/64px PNGs, updates the README PNG, and derives opaque installer artwork from the generated icon. No additional dependencies are required.

## Layout and interaction

Keep the three-region layout, resizable panels, collapsed navigation, narrow-window overlay, and focus mode. Dialogs and menus use opaque surfaces with soft shadow separation; modal scrims separate background content without blur. Neutral scrollbar colors are independent of higher-contrast control borders. Visible keyboard focus, Escape/focus restoration, readable save errors, and reduced motion remain part of the product system.

Navigation, the editor, and contents are separate panel islands, with 12px outer insets and 12px gaps on the quiet canvas. Each panel has a 10px corner radius and compact shadow separation without a decorative border. The editor scrolls inside its panel; empty/loading/error states occupy the same island. Resize handles sit in the gaps and calculate width from pointer movement rather than the window edge. Focus mode retains the inset editor island. Narrow-window navigation opens as an inset panel above the scrim.

Settings, search, Trash, confirmations, and editor popovers share the same matte surface language. Menus use 14px labels, 12px shortcuts, generous row spacing, and understated shadow separators. Destructive actions and disabled states remain distinct. Spring feedback is limited to a small button press/release and short menu/dialog entrance; navigation labels and save indicators do not bounce. Reduced motion disables animations and transitions.

## Code blocks

Code blocks use a distinct editor surface and a 44px header with a language logo, name, dropdown indicator, and visible Copy action. Cascadia/Consolas text is 14px with a 1.7 line height, two-column tab stops, preserved whitespace, and horizontal scrolling. Focus uses a restrained blue-gray edge. The dark syntax palette separates purple keywords, orange strings, yellow functions, green comments, and blue constants; the light palette uses readable red, blue, purple, and green tokens.

Language artwork is served from `public/code-languages/`; the [pinned Devicon source and license](../public/code-languages/README.md) are included. Plain text, JSON, and generic SQL use neutral document, braces, and database symbols rather than a product-specific logo. Artwork is decorative beside the visible language name. No runtime network access is required. The BlockNote JSON schema, supported grammars, raw code paste, and clipboard content remain unchanged.
