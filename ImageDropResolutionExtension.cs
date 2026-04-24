using SwarmUI.Core;
using SwarmUI.Text2Image;

namespace GlenCrawford.ImageDropResolution;

/// <summary>Automatically sets the Resolution (width/height) to match the dimensions of an image dropped onto the prompt area.</summary>
public class ImageDropResolutionExtension : Extension
{
    /// <summary>Parameter group for Image Drop Resolution controls.</summary>
    public static T2IParamGroup ImageDropResolutionGroup;

    /// <summary>Whether to update output resolution when an image is dropped onto the image prompt area.</summary>
    public static T2IRegisteredParam<bool> UpdatePromptResolutionParam;

    /// <summary>Whether to update output resolution when an image is set as the init image.</summary>
    public static T2IRegisteredParam<bool> UpdateInitResolutionParam;

    /// <summary>Whether to resize images dropped onto the image prompt area to the target side length.</summary>
    public static T2IRegisteredParam<bool> ResizePromptParam;

    /// <summary>Whether to resize images set as the init image to the target side length.</summary>
    public static T2IRegisteredParam<bool> ResizeInitParam;

    /// <summary>Target side length for image scaling. Images are scaled so their area approximates this value squared, maintaining aspect ratio and rounding to multiples of 16.</summary>
    public static T2IRegisteredParam<int> SideLengthParam;

    public override void OnInit()
    {
        ScriptFiles.Add("Assets/image_drop_resolution.js");
        ImageDropResolutionGroup = new("Image Drop Resolution", Toggles: true, Open: false, OrderPriority: 100, Description: "Automatically update the output resolution when an image is dropped or set as init image.");
        UpdatePromptResolutionParam = T2IParamTypes.Register<bool>(new(
            Name: "[IDR] Update Resolution To Image Prompt",
            Description: "When enabled, dropping an image onto the image prompt area will update the output resolution to match the image dimensions.",
            Default: "true",
            Group: ImageDropResolutionGroup,
            HideFromMetadata: true,
            IntentionalUnused: true,
            OrderPriority: 1
        ));
        UpdateInitResolutionParam = T2IParamTypes.Register<bool>(new(
            Name: "[IDR] Update Resolution To Init Image",
            Description: "When enabled, setting an init image will update the output resolution to match the image dimensions.",
            Default: "true",
            Group: ImageDropResolutionGroup,
            HideFromMetadata: true,
            IntentionalUnused: true,
            OrderPriority: 2
        ));
        ResizePromptParam = T2IParamTypes.Register<bool>(new(
            Name: "[IDR] Resize Image Prompt to Side Length",
            Description: "When enabled, images dropped onto the image prompt area are resized so their area approximates the target side length squared.",
            Default: "true",
            Group: ImageDropResolutionGroup,
            HideFromMetadata: true,
            IntentionalUnused: true,
            OrderPriority: 3
        ));
        ResizeInitParam = T2IParamTypes.Register<bool>(new(
            Name: "[IDR] Resize Init Image to Side Length",
            Description: "When enabled, images set as the init image are resized so their area approximates the target side length squared.",
            Default: "true",
            Group: ImageDropResolutionGroup,
            HideFromMetadata: true,
            IntentionalUnused: true,
            OrderPriority: 4
        ));
        SideLengthParam = T2IParamTypes.Register<int>(new(
            Name: "[IDR] Side Length",
            Description: "Target side length for image scaling. Images are scaled so their area is approximately this value squared, maintaining aspect ratio and rounding to multiples of 16.",
            Default: "1024",
            Min: 64,
            Max: 4096,
            Step: 64,
            Group: ImageDropResolutionGroup,
            ViewType: ParamViewType.SLIDER,
            HideFromMetadata: true,
            IntentionalUnused: true,
            OrderPriority: 5
        ));
    }
}
