# SwarmUI Image Drop Resolution

A [SwarmUI](https://github.com/mcmonkeyprojects/SwarmUI) extension that automatically sets the generation resolution (width/height) to match the dimensions of an image dropped or pasted onto the image prompt area.

## Features

- **Auto-resolution**: When you drop or paste an image onto the image prompt area, the output width and height are updated to match the image's dimensions.
- **Image resizing**: Dropped or pasted images are automatically scaled to a configurable target area (default 1024×1024 px) while preserving the original aspect ratio. Dimensions are rounded to the nearest multiple of 16, as required by most AI image models.
- **Init image support**: When an image is set as the Init Image, the same scaling and resolution-update logic applies automatically.
- **Master toggle**: A checkbox ("Update output resolution to match file") enables or disables all resolution updates on the fly — covers both image prompt drops and Init Image.
- **Side Length slider**: A slider next to the master toggle lets you set the target side length (64–4096, default 1024). The image is scaled so its total pixel area approximates `side length × side length`.
- **Resize toggle**: A second toggle on the Side Length slider controls whether the image itself is resized to the target dimensions. When off, the exact original dimensions are used to update the resolution inputs without resampling the image.
- **Image replace**: Dropping an image directly onto an existing prompt image replaces it in place rather than appending a new one, with a white outline preview shown while hovering.

## Installation

1. Navigate to your SwarmUI `Extensions` folder.
2. Clone this repository:
   ```
   git clone https://github.com/GlenCrawford/SwarmUIImageDropResolution
   ```
3. Restart SwarmUI.

## Usage

1. Open the **Generate** tab in SwarmUI.
2. Drop or paste an image onto the image prompt area, or set an Init Image.
   - The image is scaled to match the target side length, maintaining the original aspect ratio with dimensions rounded to multiples of 16.
   - The **Width** and **Height** inputs update to the resulting dimensions.
   - The **Aspect Ratio** is set to `Custom`.
3. Use the controls that appear below the image prompt area to adjust behaviour:
   - **Update output resolution to match file** — master toggle. Uncheck to disable all resolution and resize logic entirely.
   - **Side Length slider** — sets the target side length for scaling (default 1024). The image area is approximated as `side length²` pixels.
   - **Resize toggle** (on the slider) — when checked the image data is resampled to the calculated dimensions; when unchecked the resolution inputs are updated to the image's original pixel dimensions without resampling.
