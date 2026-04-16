# SwarmUI Image Drop Resolution

A [SwarmUI](https://github.com/mcmonkeyprojects/SwarmUI) extension that automatically sets the generation resolution (width/height) to match the dimensions of an image dropped or pasted onto the image prompt area.

## Features

- **Auto-resolution**: When you drop or paste an image onto the image prompt area, the output width and height are updated to match the image's dimensions.
- **Image resizing**: Dropped or pasted images are automatically scaled to approximately 1 megapixel (1024×1024 px target area) while preserving the original aspect ratio. Dimensions are rounded to the nearest multiple of 16, as required by most AI image models.
- **Init image support**: When an image is set as the Init Image, the same scaling and resolution-update logic applies automatically.
- **Toggle control**: A checkbox ("Update output resolution to match file") lets you enable or disable the resolution update on the fly without reloading the page.

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
   - The image is resized to approximately 1 megapixel, maintaining the original aspect ratio with dimensions rounded to multiples of 16.
   - The **Width** and **Height** inputs update to the resized dimensions.
   - The **Aspect Ratio** is set to `Custom`.
3. To keep the current resolution without updating it, uncheck **Update output resolution to match file** before dropping.
