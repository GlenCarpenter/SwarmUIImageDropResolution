/**
 * When an image is dropped/pasted onto the image prompt area,
 * optionally set the Resolution width and height to match the image dimensions.
 *
 * If the drop happens directly on an existing prompt image, replace only that image
 * instead of appending a new one, and show a white outline while hovering.
 *
 * Also monitors the Init Image input and optionally updates resolution when images are added.
 */
(function () {
    console.log('[ImageDropResolution] Extension script loaded');

    let origImagePromptAddImage = window.imagePromptAddImage;
    let promptImageReplaceTarget = null;

    if (!origImagePromptAddImage) {
        console.log('[ImageDropResolution] window.imagePromptAddImage not found, exiting');
        return;
    }
    console.log('[ImageDropResolution] window.imagePromptAddImage found, continuing initialization');

    /** Ensures the extension styles exist. */
    function ensureExtensionStyle() {
        if (document.getElementById('image_drop_resolution_replace_style')) {
            return;
        }
        let style = document.createElement('style');
        style.id = 'image_drop_resolution_replace_style';
        style.innerHTML = `.alt-prompt-image-container.image-drop-resolution-replace-target .alt-prompt-image {
    box-shadow: 0 0 0 2px white;
}
.form-check-label {
    user-select: none;
    white-space: nowrap;
}`;
        document.head.appendChild(style);
    }

    /** Ensures the dropzone has a toggle for resolution updates. */
    function ensureResolutionToggle() {
        if (document.getElementById('image_drop_resolution_toggle')) {
            return;
        }
        let promptExtraArea = document.getElementById('alt_prompt_extra_area');
        let promptImageArea = document.getElementById('alt_prompt_image_area');
        if (!promptExtraArea || !promptImageArea) {
            return;
        }
        let toggleWrap = document.createElement('div');
        toggleWrap.className = 'form-check form-switch';
        toggleWrap.innerHTML = `<input type="checkbox" class="form-check-input" id="image_drop_resolution_toggle" checked>
<label class="form-check-label" for="image_drop_resolution_toggle">Update output resolution to match file</label>`;
        promptExtraArea.appendChild(toggleWrap);
    }

    // Init image resolution updates are always enabled (no toggle needed)

    /** Returns whether resolution should be updated from dropped files. */
    function shouldUpdateResolutionFromFile() {
        let toggle = document.getElementById('image_drop_resolution_toggle');
        return !toggle || toggle.checked;
    }

    /** Returns whether resolution should be updated from init image files. */
    function shouldUpdateResolutionFromInitImage() {
        // Always enabled for init images
        return true;
    }

    /** Calculate dimensions to approximately 1 megapixel while maintaining aspect ratio and ensuring divisibility by 16. */
    function calculateOptimalDimensions(width, height) {
        const TARGET_PIXELS = 1024 * 1024; // 1 megapixel
        const DIVISOR = 16;

        // Calculate current area
        let currentArea = width * height;

        // Calculate scaling factor to reach target area
        let scaleFactor = Math.sqrt(TARGET_PIXELS / currentArea);

        // Apply scaling
        let newWidth = width * scaleFactor;
        let newHeight = height * scaleFactor;

        // Round to nearest multiple of 16
        newWidth = Math.round(newWidth / DIVISOR) * DIVISOR;
        newHeight = Math.round(newHeight / DIVISOR) * DIVISOR;

        // Ensure minimum size (at least 1 * DIVISOR)
        newWidth = Math.max(newWidth, DIVISOR);
        newHeight = Math.max(newHeight, DIVISOR);

        console.log(`[ImageDropResolution] Original: ${width}x${height} (${currentArea}px), Scaled: ${newWidth}x${newHeight} (${newWidth * newHeight}px)`);

        return { width: newWidth, height: newHeight };
    }

    /** Resize an image from a data URL to specific dimensions and return a new data URL. */
    function resizeImageDataURL(dataURL, targetWidth, targetHeight) {
        return new Promise((resolve, reject) => {
            let img = new Image();
            img.onload = () => {
                let canvas = document.createElement('canvas');
                let ctx = canvas.getContext('2d');

                // Set target dimensions
                canvas.width = targetWidth;
                canvas.height = targetHeight;

                // Draw the original image into the new dimensions
                ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

                // Get the resized image as a Data URL (PNG for quality)
                let resizedDataURL = canvas.toDataURL('image/png');
                console.log(`[ImageDropResolution] Image resized from ${img.naturalWidth}x${img.naturalHeight} to ${targetWidth}x${targetHeight}`);
                resolve(resizedDataURL);
            };
            img.onerror = (err) => {
                console.error('[ImageDropResolution] Failed to load image for resizing:', err);
                reject(err);
            };
            img.src = dataURL;
        });
    }

    /** Resize a File object to specific dimensions and return a new Blob. */
    function resizeImageFile(file, targetWidth, targetHeight) {
        return new Promise((resolve, reject) => {
            let reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    let dataURL = e.target.result;
                    let resizedDataURL = await resizeImageDataURL(dataURL, targetWidth, targetHeight);

                    // Convert data URL to Blob
                    let response = await fetch(resizedDataURL);
                    let blob = await response.blob();

                    // Create a new File object with the original name
                    let resizedFile = new File([blob], file.name, { type: 'image/png' });
                    resolve(resizedFile);
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    /** Applies the hover highlight to the current replacement target. */
    function setPromptImageReplaceTarget(target) {
        if (promptImageReplaceTarget) {
            promptImageReplaceTarget.classList.remove('image-drop-resolution-replace-target');
        }
        promptImageReplaceTarget = target;
        if (promptImageReplaceTarget) {
            promptImageReplaceTarget.classList.add('image-drop-resolution-replace-target');
        }
    }

    /** Returns true if the drag event appears to contain file/image data. */
    function isImageFileDragEvent(e) {
        if (!e || !e.dataTransfer) {
            return false;
        }
        if (e.dataTransfer.items) {
            for (let item of e.dataTransfer.items) {
                if (item.kind == 'file' && (!item.type || item.type.startsWith('image/'))) {
                    return true;
                }
            }
        }
        if (e.dataTransfer.types) {
            for (let type of e.dataTransfer.types) {
                if (type == 'Files') {
                    return true;
                }
            }
        }
        return false;
    }

    /** Finds the existing prompt image container under the cursor, if any. */
    function getPromptImageReplaceTarget(e) {
        if (!isImageFileDragEvent(e) || !e.target || !e.target.closest) {
            return null;
        }
        let target = e.target.closest('.alt-prompt-image-container');
        if (!target || !target.querySelector('.alt-prompt-image')) {
            return null;
        }
        return target;
    }

    /** Monitors the init image input for changes and updates resolution. */
    function attachInitImageResolutionHandler() {
        console.log('[ImageDropResolution] attachInitImageResolutionHandler called');

        let initImageInput = document.getElementById('input_initimage');
        console.log('[ImageDropResolution] Initial check - initImageInput:', initImageInput);

        if (!initImageInput) {
            // Element not ready yet, retry after a short delay
            console.log('[ImageDropResolution] Init image input not found, starting retry mechanism...');
            let retryCount = 0;
            let retryInterval = setInterval(() => {
                retryCount++;
                initImageInput = document.getElementById('input_initimage');
                console.log(`[ImageDropResolution] Retry ${retryCount}/50 - initImageInput:`, initImageInput);

                if (initImageInput) {
                    console.log('[ImageDropResolution] Init image input found! Setting up resolution handler...');
                    clearInterval(retryInterval);
                    setupMediaFileOverride();
                }
                else {
                    if (retryCount > 50) {
                        // Give up after 5 seconds
                        console.log('[ImageDropResolution] Gave up after 50 retries (5 seconds)');
                        clearInterval(retryInterval);
                    }
                }
            }, 100);
            return;
        }

        console.log('[ImageDropResolution] Init image input found immediately, setting up...');
        setupMediaFileOverride();
    }

    /** Sets up the override for setMediaFileDirect to capture init image dimensions and resize. */
    function setupMediaFileOverride() {
        // Override setMediaFileDirect to hook into when image dimensions are available
        if (window.setMediaFileDirect && !window.__originalSetMediaFileDirect) {
            window.__originalSetMediaFileDirect = window.setMediaFileDirect;
            window.setMediaFileDirect = async function (elem, src, type, name, longName = null, callback = null) {
                let finalSrc = src;

                // Check if this is the init image input and type is image or video
                let initImageInput = document.getElementById('input_initimage');
                if (initImageInput && elem === initImageInput && type === 'image' && shouldUpdateResolutionFromInitImage()) {
                    // Load the image to get dimensions
                    let img = new Image();
                    await new Promise((resolve, reject) => {
                        img.onload = resolve;
                        img.onerror = reject;
                        img.src = src;
                    }).catch(err => {
                        console.error('[ImageDropResolution] Failed to load init image:', err);
                    });

                    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                        // Calculate optimal dimensions (scaled to ~1MP, divisible by 16)
                        let optimal = calculateOptimalDimensions(img.naturalWidth, img.naturalHeight);

                        // Resize the image
                        try {
                            finalSrc = await resizeImageDataURL(src, optimal.width, optimal.height);
                        } catch (err) {
                            console.error('[ImageDropResolution] Failed to resize init image, using original:', err);
                        }

                        // Update resolution inputs
                        let inputWidth = document.getElementById('input_width');
                        let inputHeight = document.getElementById('input_height');
                        if (inputWidth && inputHeight) {
                            inputWidth.value = optimal.width;
                            inputHeight.value = optimal.height;
                            triggerChangeFor(inputWidth);
                            triggerChangeFor(inputHeight);
                        }
                        let inputAspectRatio = document.getElementById('input_aspectratio');
                        if (inputAspectRatio) {
                            inputAspectRatio.value = 'Custom';
                            triggerChangeFor(inputAspectRatio);
                        }
                    }
                }

                let wrappedCallback = () => {
                    if (callback) {
                        callback();
                    }
                };

                return window.__originalSetMediaFileDirect(elem, finalSrc, type, name, longName, wrappedCallback);
            };
        }
    }

    /** Hooks drag events so direct drops on existing images preview as replacements. */
    function attachPromptImageReplaceHandlers() {
        ensureExtensionStyle();
        ensureResolutionToggle();
        let dragArea = document.getElementById('alt_prompt_region');
        if (!dragArea) {
            return;
        }
        let updateReplaceTarget = (e) => {
            if (!isImageFileDragEvent(e)) {
                setPromptImageReplaceTarget(null);
                return;
            }
            setPromptImageReplaceTarget(getPromptImageReplaceTarget(e));
        };
        dragArea.addEventListener('dragenter', updateReplaceTarget, true);
        dragArea.addEventListener('dragover', updateReplaceTarget, true);
        dragArea.addEventListener('dragleave', (e) => {
            if (!dragArea.contains(e.relatedTarget)) {
                setPromptImageReplaceTarget(null);
            }
        }, true);
        dragArea.addEventListener('drop', (e) => {
            setPromptImageReplaceTarget(getPromptImageReplaceTarget(e));
        }, true);
        document.addEventListener('drop', () => {
            setPromptImageReplaceTarget(null);
        }, true);
        document.addEventListener('dragend', () => {
            setPromptImageReplaceTarget(null);
        }, true);
    }

    /** Replaces the hovered prompt image instead of appending a new one. */
    async function replacePromptImage(targetContainer, file) {
        let imageObject = targetContainer ? targetContainer.querySelector('.alt-prompt-image') : null;
        if (!imageObject) {
            origImagePromptAddImage(file);
            return;
        }

        // Read the file and resize if needed
        let reader = new FileReader();
        reader.onload = async (e) => {
            if (!targetContainer.isConnected) {
                origImagePromptAddImage(file);
                return;
            }

            let data = e.target.result;

            // Load image to get dimensions and resize if needed
            let img = new Image();
            img.onload = async () => {
                let finalData = data;

                // Calculate optimal dimensions and resize
                if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                    let optimal = calculateOptimalDimensions(img.naturalWidth, img.naturalHeight);
                    try {
                        finalData = await resizeImageDataURL(data, optimal.width, optimal.height);
                    } catch (err) {
                        console.error('[ImageDropResolution] Failed to resize image, using original:', err);
                    }
                }

                imageObject.src = finalData;
                imageObject.height = 128;
                imageObject.dataset.filedata = finalData;
                let clearButton = document.getElementById('alt_prompt_image_clear_button');
                if (clearButton) {
                    clearButton.style.display = '';
                }
                if (window.showRevisionInputs) {
                    showRevisionInputs(true);
                }
                if (window.genTabLayout && genTabLayout.altPromptSizeHandle) {
                    genTabLayout.altPromptSizeHandle();
                }
            };
            img.src = data;
        };
        reader.readAsDataURL(file);
    }

    /** Updates the generation resolution to match the dropped image and returns the resized file. */
    async function updateResolutionFromImage(file) {
        return new Promise((resolve, reject) => {
            let img = new Image();
            let reader = new FileReader();
            reader.onload = async (e) => {
                img.onload = async () => {
                    let resizedFile = file;

                    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                        // Calculate optimal dimensions (scaled to ~1MP, divisible by 16)
                        let optimal = calculateOptimalDimensions(img.naturalWidth, img.naturalHeight);

                        let inputWidth = document.getElementById('input_width');
                        let inputHeight = document.getElementById('input_height');
                        if (inputWidth && inputHeight) {
                            inputWidth.value = optimal.width;
                            inputHeight.value = optimal.height;
                            triggerChangeFor(inputWidth);
                            triggerChangeFor(inputHeight);
                        }
                        let inputAspectRatio = document.getElementById('input_aspectratio');
                        if (inputAspectRatio) {
                            inputAspectRatio.value = 'Custom';
                            triggerChangeFor(inputAspectRatio);
                        }

                        // Resize the file
                        try {
                            resizedFile = await resizeImageFile(file, optimal.width, optimal.height);
                        } catch (err) {
                            console.error('[ImageDropResolution] Failed to resize file, using original:', err);
                        }
                    }

                    resolve(resizedFile);
                };
                img.onerror = reject;
                img.src = e.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    window.imagePromptAddImage = async function (file) {
        let replaceTarget = promptImageReplaceTarget;
        setPromptImageReplaceTarget(null);

        let finalFile = file;

        // Resize and update resolution if enabled
        if (shouldUpdateResolutionFromFile()) {
            try {
                finalFile = await updateResolutionFromImage(file);
            } catch (err) {
                console.error('[ImageDropResolution] Error processing image:', err);
            }
        }

        if (replaceTarget) {
            replacePromptImage(replaceTarget, finalFile);
        }
        else {
            origImagePromptAddImage(finalFile);
        }
    };

    if (document.readyState == 'loading') {
        console.log('[ImageDropResolution] Document still loading, waiting for DOMContentLoaded...');
        document.addEventListener('DOMContentLoaded', () => {
            console.log('[ImageDropResolution] DOMContentLoaded fired');
            attachPromptImageReplaceHandlers();
            attachInitImageResolutionHandler();
        });
    }
    else {
        console.log('[ImageDropResolution] Document already loaded, initializing immediately');
        attachPromptImageReplaceHandlers();
        attachInitImageResolutionHandler();
    }
})();
