using SwarmUI.Core;
using SwarmUI.Text2Image;
using SwarmUI.Media;
using SwarmUI.Accounts;
using SwarmUI.WebAPI;
using Newtonsoft.Json.Linq;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Processing;

namespace GlenCarpenter.Extensions.ImageDropResolutionExtension;

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

    /// <summary>Permission group for Image Drop Resolution extension.</summary>
    public static readonly PermInfoGroup IDRPermGroup = new("ImageDropResolution", "Permissions related to Image Drop Resolution functionality.");

    /// <summary>Permission to call the server-side image resize API.</summary>
    public static readonly PermInfo PermResizeImage = Permissions.Register(new(
        "imagedropresolution_resize_image",
        "Resize Image",
        "Allows the user to call the Image Drop Resolution server-side image resize API.",
        PermissionDefault.USER,
        IDRPermGroup));

    public override void OnInit()
    {
        ScriptFiles.Add("Assets/image_drop_resolution.js");
        API.RegisterAPICall(ResizeImage, false, PermResizeImage);
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

    /// <summary>Resizes an image to the given dimensions using Lanczos3 high-quality resampling and returns it as a PNG data URL.</summary>
    [API.APIDescription("Resizes an image to the given dimensions using Lanczos3 high-quality resampling.",
        """
            "image": "data:image/png;base64,..."
        """)]
    public static async Task<JObject> ResizeImage(Session session,
        [API.APIParameter("The source image as a base64 data URL.")] string image,
        [API.APIParameter("Target width in pixels.")] int width,
        [API.APIParameter("Target height in pixels.")] int height)
    {
        if (width < 1 || height < 1 || width > 16384 || height > 16384)
        {
            return new JObject() { ["error"] = "Invalid dimensions: width and height must each be between 1 and 16384." };
        }
        ImageFile imgFile;
        try
        {
            imgFile = ImageFile.FromDataString(image);
        }
        catch (Exception)
        {
            return new JObject() { ["error"] = "Invalid image data." };
        }
        SixLabors.ImageSharp.Image isImg = imgFile.ToIS;
        if (isImg.Width == width && isImg.Height == height)
        {
            return new JObject() { ["image"] = image };
        }
        SixLabors.ImageSharp.Image resized = isImg.Clone(ctx => ctx.Resize(new ResizeOptions()
        {
            Size = new Size(width, height),
            Sampler = KnownResamplers.Lanczos3,
            Mode = ResizeMode.Stretch
        }));
        byte[] pngBytes = ImageFile.ISImgToPngBytes(resized);
        string b64 = Convert.ToBase64String(pngBytes);
        return new JObject() { ["image"] = $"data:image/png;base64,{b64}" };
    }
}
