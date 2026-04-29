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

    /** Maps each control element ID to its localStorage key and type. */
    let idrPrefControls = [
        { id: 'input_group_content_imagedropresolution_toggle', key: 'swarm_idr_enabled', isCheckbox: true },
        { id: 'input_idrupdateresolutiontoimageprompt', key: 'swarm_idr_update_prompt_res', isCheckbox: true },
        { id: 'input_idrupdateresolutiontoinitimage', key: 'swarm_idr_update_init_res', isCheckbox: true },
        { id: 'input_idrresizeimageprompttosidelength', key: 'swarm_idr_resize_prompt', isCheckbox: true },
        { id: 'input_idrresizeinitimagetosidelength', key: 'swarm_idr_resize_init', isCheckbox: true },
        { id: 'input_idrsidelength', key: 'swarm_idr_side_length', isCheckbox: false }
    ];

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
#input_group_content_imagedropresolution {
    flex-direction: column;
    gap: 6px;
}
#input_group_content_imagedropresolution > div.auto-input {
    flex: none;
    min-width: unset;
    width: 100%;
}`;
        document.head.appendChild(style);
    }

    /** Converts a generated auto-checkbox input to a toggle-switch style input. */
    function convertCheckboxToToggle(elemId) {
        let checkbox = document.getElementById(elemId);
        if (!checkbox) {
            return;
        }
        checkbox.classList.remove('auto-checkbox');
        checkbox.classList.add('auto-slider-toggle', 'form-check-input');
        let wrap = document.createElement('span');
        wrap.className = 'form-check form-switch toggle-switch display-inline-block';
        checkbox.parentNode.insertBefore(wrap, checkbox);
        wrap.appendChild(checkbox);
        let toggleContent = document.createElement('div');
        toggleContent.className = 'auto-slider-toggle-content';
        wrap.appendChild(toggleContent);
    }

    /** Saves the current extension preference values to localStorage. */
    function savePreferences() {
        for (let ctrl of idrPrefControls) {
            let elem = document.getElementById(ctrl.id);
            if (elem) {
                localStorage.setItem(ctrl.key, ctrl.isCheckbox ? elem.checked : elem.value);
            }
        }
    }

    /** Loads extension preferences from localStorage and applies them to the controls. */
    function loadPreferences() {
        for (let ctrl of idrPrefControls) {
            let stored = localStorage.getItem(ctrl.key);
            if (stored === null) {
                continue;
            }
            let elem = document.getElementById(ctrl.id);
            if (!elem) {
                continue;
            }
            if (ctrl.isCheckbox) {
                elem.checked = stored === 'true';
                triggerChangeFor(elem);
            }
            else {
                elem.value = stored;
                triggerChangeFor(elem);
            }
        }
    }

    /** Attaches change listeners to extension controls to persist preferences on change. */
    function attachPreferenceSavers() {
        for (let ctrl of idrPrefControls) {
            let elem = document.getElementById(ctrl.id);
            if (elem) {
                elem.addEventListener('change', savePreferences);
            }
        }
    }

    /** Registers post-param-build steps to convert boolean params to toggle-switch style. */
    function applyToggleStyles() {
        if (typeof postParamBuildSteps == 'undefined') {
            return;
        }
        postParamBuildSteps.push(() => {
            convertCheckboxToToggle('input_idrupdateresolutiontoimageprompt');
            convertCheckboxToToggle('input_idrupdateresolutiontoinitimage');
            convertCheckboxToToggle('input_idrresizeimageprompttosidelength');
            convertCheckboxToToggle('input_idrresizeinitimagetosidelength');
            loadPreferences();
            attachPreferenceSavers();
        });
    }

    /** Returns whether the extension is globally enabled via the group toggle. */
    function isExtensionEnabled() {
        let toggle = document.getElementById('input_group_content_imagedropresolution_toggle');
        return !toggle || toggle.checked;
    }

    /** Returns whether resolution should be updated when an image is dropped onto the image prompt area. */
    function shouldUpdatePromptResolution() {
        let toggle = document.getElementById('input_idrupdateresolutiontoimageprompt');
        return !toggle || toggle.checked;
    }

    /** Returns whether resolution should be updated when an image is set as the init image. */
    function shouldUpdateInitResolution() {
        let toggle = document.getElementById('input_idrupdateresolutiontoinitimage');
        return !toggle || toggle.checked;
    }

    /** Returns whether images dropped onto the image prompt area should be resized to the target side length. */
    function shouldResizePrompt() {
        let toggle = document.getElementById('input_idrresizeimageprompttosidelength');
        return !toggle || toggle.checked;
    }

    /** Returns whether the init image should be resized to the target side length. */
    function shouldResizeInit() {
        let toggle = document.getElementById('input_idrresizeinitimagetosidelength');
        return !toggle || toggle.checked;
    }

    /** Returns the target side length from the slider, defaulting to 1024. */
    function getTargetSideLength() {
        let input = document.getElementById('input_idrsidelength');
        let val = input ? parseInt(input.value) : 1024;
        return (isNaN(val) || val < 64) ? 1024 : val;
    }

    /** Calculate dimensions scaled to approximately targetSideLength^2 pixels while maintaining aspect ratio and ensuring divisibility by 16. */
    function calculateOptimalDimensions(width, height, targetSideLength = 1024) {
        const TARGET_PIXELS = targetSideLength * targetSideLength;
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

    /** Resize an image from a data URL to specific dimensions using server-side Lanczos3 resampling and return a new data URL. */
    function resizeImageDataURL(dataURL, targetWidth, targetHeight) {
        return new Promise((resolve, reject) => {
            genericRequest('ResizeImage', { image: dataURL, width: targetWidth, height: targetHeight }, data => {
                if (data.image) {
                    console.log(`[ImageDropResolution] Image resized to ${targetWidth}x${targetHeight} via server (Lanczos3)`);
                    resolve(data.image);
                }
                else {
                    reject(new Error(data.error || 'Server resize returned no image'));
                }
            }, 0, err => {
                reject(new Error(err));
            });
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
                if (isExtensionEnabled() && initImageInput && elem === initImageInput && type === 'image' && (shouldUpdateInitResolution() || shouldResizeInit())) {
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
                        let targetWidth = img.naturalWidth;
                        let targetHeight = img.naturalHeight;

                        if (shouldResizeInit()) {
                            let optimal = calculateOptimalDimensions(img.naturalWidth, img.naturalHeight, getTargetSideLength());
                            targetWidth = optimal.width;
                            targetHeight = optimal.height;
                            try {
                                finalSrc = await resizeImageDataURL(src, targetWidth, targetHeight);
                            } catch (err) {
                                console.error('[ImageDropResolution] Failed to resize init image, using original:', err);
                                targetWidth = img.naturalWidth;
                                targetHeight = img.naturalHeight;
                            }
                        }

                        if (shouldUpdateInitResolution()) {
                            // Update resolution inputs
                            let inputWidth = document.getElementById('input_width');
                            let inputHeight = document.getElementById('input_height');
                            if (inputWidth && inputHeight) {
                                inputWidth.value = targetWidth;
                                inputHeight.value = targetHeight;
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

    /** Replaces the hovered prompt image instead of appending a new one. The file has already been processed (resized/kept exact) by the caller. */
    async function replacePromptImage(targetContainer, file) {
        let imageObject = targetContainer ? targetContainer.querySelector('.alt-prompt-image') : null;
        if (!imageObject) {
            origImagePromptAddImage(file);
            return;
        }

        let reader = new FileReader();
        reader.onload = (e) => {
            if (!targetContainer.isConnected) {
                origImagePromptAddImage(file);
                return;
            }
            let data = e.target.result;
            imageObject.src = data;
            imageObject.height = 128;
            imageObject.dataset.filedata = data;
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
        reader.readAsDataURL(file);
    }

    /** Updates the generation resolution to match the dropped image and returns the (possibly resized) file. */
    async function updateResolutionFromImage(file) {
        return new Promise((resolve, reject) => {
            let img = new Image();
            let reader = new FileReader();
            reader.onload = async (e) => {
                img.onload = async () => {
                    let outFile = file;

                    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                        let targetWidth = img.naturalWidth;
                        let targetHeight = img.naturalHeight;

                        if (shouldResizePrompt()) {
                            let optimal = calculateOptimalDimensions(img.naturalWidth, img.naturalHeight, getTargetSideLength());
                            targetWidth = optimal.width;
                            targetHeight = optimal.height;
                            try {
                                outFile = await resizeImageFile(file, targetWidth, targetHeight);
                            } catch (err) {
                                console.error('[ImageDropResolution] Failed to resize file, using original:', err);
                                targetWidth = img.naturalWidth;
                                targetHeight = img.naturalHeight;
                            }
                        }

                        if (shouldUpdatePromptResolution()) {
                            let inputWidth = document.getElementById('input_width');
                            let inputHeight = document.getElementById('input_height');
                            if (inputWidth && inputHeight) {
                                inputWidth.value = targetWidth;
                                inputHeight.value = targetHeight;
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

                    resolve(outFile);
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

        // Resize and/or update resolution if enabled
        if (isExtensionEnabled() && (shouldUpdatePromptResolution() || shouldResizePrompt())) {
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

    applyToggleStyles();

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
