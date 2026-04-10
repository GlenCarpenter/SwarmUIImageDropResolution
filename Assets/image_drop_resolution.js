/**
 * When an image is dropped/pasted onto the image prompt area,
 * optionally set the Resolution width and height to match the image dimensions.
 *
 * If the drop happens directly on an existing prompt image, replace only that image
 * instead of appending a new one, and show a white outline while hovering.
 */
(function () {
    let origImagePromptAddImage = window.imagePromptAddImage;
    let promptImageReplaceTarget = null;

    if (!origImagePromptAddImage) {
        return;
    }

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

    /** Returns whether resolution should be updated from dropped files. */
    function shouldUpdateResolutionFromFile() {
        let toggle = document.getElementById('image_drop_resolution_toggle');
        return !toggle || toggle.checked;
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
    function replacePromptImage(targetContainer, file) {
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

    /** Updates the generation resolution to match the dropped image. */
    function updateResolutionFromImage(file) {
        let img = new Image();
        let reader = new FileReader();
        reader.onload = (e) => {
            img.onload = () => {
                if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                    let inputWidth = document.getElementById('input_width');
                    let inputHeight = document.getElementById('input_height');
                    if (inputWidth && inputHeight) {
                        inputWidth.value = img.naturalWidth;
                        inputHeight.value = img.naturalHeight;
                        triggerChangeFor(inputWidth);
                        triggerChangeFor(inputHeight);
                    }
                    let inputAspectRatio = document.getElementById('input_aspectratio');
                    if (inputAspectRatio) {
                        inputAspectRatio.value = 'Custom';
                        triggerChangeFor(inputAspectRatio);
                    }
                }
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    window.imagePromptAddImage = function (file) {
        let replaceTarget = promptImageReplaceTarget;
        setPromptImageReplaceTarget(null);
        if (replaceTarget) {
            replacePromptImage(replaceTarget, file);
        }
        else {
            origImagePromptAddImage(file);
        }
        if (shouldUpdateResolutionFromFile()) {
            updateResolutionFromImage(file);
        }
    };

    if (document.readyState == 'loading') {
        document.addEventListener('DOMContentLoaded', attachPromptImageReplaceHandlers);
    }
    else {
        attachPromptImageReplaceHandlers();
    }
})();
