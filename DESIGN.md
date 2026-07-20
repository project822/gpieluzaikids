---
name: TechNexus Deep Ocean
colors:
  surface: '#1E293B'
  surface-dim: '#10131a'
  surface-bright: '#363941'
  surface-container-lowest: '#0b0e15'
  surface-container-low: '#191b23'
  surface-container: '#1d2027'
  surface-container-high: '#272a31'
  surface-container-highest: '#32353c'
  on-surface: '#FFFFFF'
  on-surface-variant: '#94A3B8'
  inverse-surface: '#e1e2ec'
  inverse-on-surface: '#2e3038'
  outline: '#334155'
  outline-variant: '#424754'
  surface-tint: '#adc6ff'
  primary: '#adc6ff'
  on-primary: '#002e6a'
  primary-container: '#4d8eff'
  on-primary-container: '#00285d'
  inverse-primary: '#005ac2'
  secondary: '#bcc7de'
  on-secondary: '#263143'
  secondary-container: '#3e495d'
  on-secondary-container: '#aeb9d0'
  tertiary: '#ffb786'
  on-tertiary: '#502400'
  tertiary-container: '#df7412'
  on-tertiary-container: '#461f00'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#d8e2ff'
  primary-fixed-dim: '#adc6ff'
  on-primary-fixed: '#001a42'
  on-primary-fixed-variant: '#004395'
  secondary-fixed: '#d8e3fb'
  secondary-fixed-dim: '#bcc7de'
  on-secondary-fixed: '#111c2d'
  on-secondary-fixed-variant: '#3c475a'
  tertiary-fixed: '#ffdcc6'
  tertiary-fixed-dim: '#ffb786'
  on-tertiary-fixed: '#311400'
  on-tertiary-fixed-variant: '#723600'
  background: '#0F172A'
  on-background: '#e1e2ec'
  surface-variant: '#32353c'
  accent-glow: rgba(59, 130, 246, 0.12)
typography:
  display-xl:
    fontFamily: Hanken Grotesk
    fontSize: 64px
    fontWeight: '800'
    lineHeight: 72px
    letterSpacing: -0.02em
  display-xl-mobile:
    fontFamily: Hanken Grotesk
    fontSize: 40px
    fontWeight: '800'
    lineHeight: 48px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Hanken Grotesk
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
  headline-md:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.05em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 32px
  gutter: 24px
  margin-mobile: 20px
  margin-desktop: 64px
  section-v-padding: 120px
  container-max: 1280px
---

## Brand & Style
The brand identity is "Deep Ocean" — a sophisticated fusion of minimalism and glassmorphism. It evokes a sense of vast, digital space through the use of atmospheric background orbs and translucent layers. The personality is precise, technical, and premium, targeting a developer or high-end enterprise audience. 

Visual depth is achieved not through shadows, but through light emission and blurred transparency. The style relies on the contrast between the "void" (deep navy backgrounds) and "digital light" (vibrant blue accents and glowing states).

## Colors
The palette is rooted in a "Deep Ocean" hierarchy. The primary color is a vibrant **Accent Blue (#3B82F6)**, used sparingly for critical actions and brand highlights to represent digital energy. 

The neutrals are strictly cool-toned:
- **Background**: A deep navy (#0F172A) that acts as the "void."
- **Surface**: A slightly lighter slate (#1E293B) used for glass panels.
- **On-Surface**: Pure white (#FFFFFF) for high-contrast headings.
- **On-Surface-Variant**: A muted steel (#94A3B8) for secondary text and labels.

Interactive elements should utilize low-opacity blue glows (8-12% opacity) to simulate luminescence against the dark background.

## Typography
The system uses a tri-font strategy to delineate hierarchy:
- **Hanken Grotesk** serves as the Display and Headline face. It is used with heavy weights (700-800) and tight letter-spacing to create a bold, modern impact.
- **Inter** provides high legibility for Body text, maintaining a neutral and functional tone.
- **Geist** is reserved for Labels and technical metadata. Its monospaced-adjacent feel reinforces the "TechNexus" technical aesthetic.

For mobile, `display-xl` must scale down to `display-xl-mobile` to maintain readability. All labels should be set in uppercase with increased letter-spacing (0.05em to 0.2em for utility labels).

## Layout & Spacing
The layout follows a fixed-grid philosophy with a maximum container width of 1280px. Large vertical breathing room (`section-v-padding`) is essential to maintain the minimalist "void" aesthetic.

Spacing follows an 8px rhythmic scale:
- **Margins**: 64px on desktop, reducing to 20px on mobile.
- **Gutters**: 24px between horizontal elements.
- **Stacking**: Use `stack-lg` (32px) for spacing between major content blocks (e.g., headline to body) and `stack-md` (16px) for internal component spacing.

## Elevation & Depth
Elevation is expressed through **Glassmorphism** and **Luminescence** rather than traditional drop shadows.

- **Surface Layers**: Use "Glass Panels" — semi-transparent fills (Background: `rgba(30, 41, 59, 0.5)`) with a `12px` backdrop blur. 
- **Borders**: Elements are defined by thin, low-opacity borders (`1px solid rgba(51, 65, 85, 0.5)`) or a subtle white highlight (`border-white/5`).
- **Glows**: High-priority elements use a `shadow-lg` colored glow (e.g., `shadow-blue-500/20`) to appear as though they are emitting light onto the surface below.

## Shapes
The shape language is "Soft-Modern," utilizing subtle rounding that avoids being overly bubbly.
- **Standard Radius**: 0.125rem (2px) for a sharp, technical look on buttons and small inputs.
- **Panel Radius**: 0.25rem (4px) to 0.5rem (8px) for containers and cards.
- **Specialty Radius**: Full pill-shapes (e.g., `rounded-full`) are reserved exclusively for badges and decorative tag elements to distinguish them from functional UI components.

## Components
- **Buttons**:
    - *Primary*: Solid #3B82F6 fill, bold Inter font, 4px radius, with a blue outer glow.
    - *Ghost*: Transparent background, #94A3B8 text, transitions to white on hover.
- **Glass Panels (Cards)**:
    - Containers for content that require a 12px backdrop-blur and a 1px slate border. Hover states should increase border opacity or tint the border blue.
- **Badges**:
    - Pill-shaped, low-opacity primary backgrounds (blue-500/10) with a center-aligned "status dot" that features a concentrated glow.
- **Navigation**:
    - Sticky top bar with a glass-panel effect and a 1px bottom border. Active links are indicated by a 2px primary blue bottom border offset by padding.
- **Scroll Indicators**:
    - Minimalist vertical stacks using Material Symbols (keyboard_arrow_down) with a subtle bounce animation.