# SwarmUI Image Drop Resolution

A [SwarmUI](https://github.com/mcmonkeyprojects/SwarmUI) extension that automatically sets the generation resolution (width/height) to match the dimensions of an image dropped or pasted onto the image prompt area.

## Features

- **Auto-resolution**: When you drop or paste an image onto the image prompt area, the output width and height are updated to match the image's dimensions.
- **Toggle control**: A checkbox ("Update output resolution to match file") lets you enable or disable the resolution update on the fly without reloading the page.
- **In-place image replacement**: Dropping an image directly onto an existing prompt image replaces it rather than appending a new one. A white outline highlights the target image while hovering.

## Installation

1. Navigate to your SwarmUI `Extensions` folder.
2. Clone this repository:
   ```
   git clone https://github.com/GlenCrawford/SwarmUIImageDropResolution
   ```
3. Restart SwarmUI.

## Usage

1. Open the **Generate** tab in SwarmUI.
2. Drop or paste an image onto the image prompt area.
   - The **Width** and **Height** inputs will update to match the image dimensions.
   - The **Aspect Ratio** will be set to `Custom`.
3. To keep the current resolution, uncheck **Update output resolution to match file** before dropping.
4. To replace an existing prompt image, drag a new image directly over it — a white outline indicates it will be replaced rather than appended.
