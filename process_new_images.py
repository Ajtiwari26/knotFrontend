import os
import shutil
from PIL import Image

ICON_SRC = "/Users/ajay/.gemini/antigravity/brain/86ed01a3-fc0b-44f7-b810-2198297b6af6/media__1776776456135.jpg"
ASSETS_DIR = "/Users/ajay/Desktop/Projects/knot/mobile/assets"
PREVIEW_DIR = "/Users/ajay/.gemini/antigravity/brain/86ed01a3-fc0b-44f7-b810-2198297b6af6"

def process_images():
    print("Processing Icon...")
    icon_img = Image.open(ICON_SRC).convert("RGB")
    
    w, h = icon_img.size
    print(f"Original size: {w}x{h}")
    
    # We want a square crop centered horizontally.
    # The knot is square, so it should fit within a h x h box.
    crop_size = min(w, h)
    
    left = (w - crop_size) // 2
    top = (h - crop_size) // 2
    right = left + crop_size
    bottom = top + crop_size
    
    icon_cropped = icon_img.crop((left, top, right, bottom))
    
    # Let's add a tiny margin of background color around it just in case
    bg_color = icon_img.getpixel((5, 5))
    margin = int(crop_size * 0.05) # 5% margin
    target_size = crop_size + 2 * margin
    
    icon_square = Image.new("RGB", (target_size, target_size), bg_color)
    icon_square.paste(icon_cropped, (margin, margin))
    
    # Resize to 1024x1024
    icon_final = icon_square.resize((1024, 1024), Image.LANCZOS)
    
    icon_path = os.path.join(ASSETS_DIR, "icon.png")
    adaptive_path = os.path.join(ASSETS_DIR, "adaptive-icon.png")
    
    icon_final.save(icon_path, "PNG")
    icon_final.save(adaptive_path, "PNG")
    
    shutil.copy(icon_path, os.path.join(PREVIEW_DIR, "preview_icon.png"))
    print("Done")

if __name__ == "__main__":
    process_images()
