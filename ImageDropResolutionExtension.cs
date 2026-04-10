using SwarmUI.Core;

namespace GlenCrawford.ImageDropResolution;

/// <summary>Automatically sets the Resolution (width/height) to match the dimensions of an image dropped onto the prompt area.</summary>
public class ImageDropResolutionExtension : Extension
{
    public override void OnPreInit()
    {
        ScriptFiles.Add("Assets/image_drop_resolution.js");
    }
}
