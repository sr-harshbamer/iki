import os
import urllib.request
import zipfile
import sys

MODEL_URL = "https://alphacephei.com/vosk/models/vosk-model-small-en-in-0.4.zip"
ZIP_PATH = "vosk-model.zip"
MODEL_DIR = "model"

def main():
    if os.path.exists(MODEL_DIR) and len(os.listdir(MODEL_DIR)) > 0:
        print("Vosk model already downloaded and extracted.")
        return

    print("Downloading Vosk model (approx 18MB)...")
    try:
        urllib.request.urlretrieve(MODEL_URL, ZIP_PATH)
        print("Download complete. Extracting model...")
    except Exception as e:
        print(f"Error downloading model: {e}")
        sys.exit(1)

    try:
        with zipfile.ZipFile(ZIP_PATH, 'r') as zip_ref:
            zip_ref.extractall("temp_extract")
        
        # Move extracted folder contents to './model'
        extracted_folder_name = "vosk-model-small-en-in-0.4"
        src_dir = os.path.join("temp_extract", extracted_folder_name)
        
        if not os.path.exists(MODEL_DIR):
            os.makedirs(MODEL_DIR)
            
        for file_name in os.listdir(src_dir):
            os.rename(os.path.join(src_dir, file_name), os.path.join(MODEL_DIR, file_name))
            
        print("Extraction complete. Cleaning up...")
        os.remove(ZIP_PATH)
        os.rmdir(src_dir)
        os.rmdir("temp_extract")
        print("Vosk model successfully setup at ./model!")
    except Exception as e:
        print(f"Error extracting zip: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
