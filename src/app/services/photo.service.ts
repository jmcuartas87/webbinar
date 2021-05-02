import { Injectable } from '@angular/core';
import { Plugins, CameraResultType, Capacitor, FilesystemDirectory, CameraPhoto, CameraSource } from '@capacitor/core';
import { Platform } from '@ionic/angular';


const { Camera, Filesystem, Storage } = Plugins;

export interface Photo {
  filepath: string;
  webviewPath: string;
}

const PHOTO_STORAGE = 'photos';

@Injectable({
  providedIn: 'root'
})
export class PhotoService {
  public photos: Photo[] = [];
  private platform: Platform;

  constructor(
    platform: Platform
  ) {
    this.platform = platform;
  }

  public async loadSaved() {
    const photoList = await Storage.get({ key: PHOTO_STORAGE });
    this.photos = JSON.parse(photoList.value) || [];

    if (this.platform.is('hybrid')) {
      return;
    }

    this.photos.map(async (photo) => {
      const readFile = await Filesystem.readFile({
        path: photo.filepath,
        directory: FilesystemDirectory.Data
      });

      photo.webviewPath = `data:image/jpeg;base64,${readFile.data}`;
    });
  }

  public async addNewToGallery() {
    const capturePhoto = await Camera.getPhoto({
      resultType: CameraResultType.Uri,
      source: CameraSource.Camera,
      quality: 100
    });

    const savedImageFile = await this.savePicture(capturePhoto);
    this.photos.unshift(savedImageFile);

    Storage.set({
      key: PHOTO_STORAGE,
      value: JSON.stringify(this.photos)
    });
  }

  public async savePicture(cameraPhoto: CameraPhoto) {
    const base64Data = await this.readAsBase64(cameraPhoto);

    const fileName = new Date().getTime() + '.jpeg';
    const savedFile = await Filesystem.writeFile({
      path: fileName,
      data: base64Data,
      directory: FilesystemDirectory.Data
    });

    if (this.platform.is('hybrid')) {
      return {
        filepath: savedFile.uri,
        webviewPath: Capacitor.convertFileSrc(savedFile.uri)
      } as Photo;
    }

    return {
      filepath: fileName,
      webviewPath: cameraPhoto.webPath
    } as Photo;
  }

  public async readAsBase64(cameraPhoto: CameraPhoto) {
    if (this.platform.is('hybrid')) {
      const file = await Filesystem.readFile({
        path: cameraPhoto.path
      });

      return file.data;
    }

    const response = await fetch(cameraPhoto.webPath);
    const blob = await response.blob();

    return await this.convertBlobToBase64(blob) as string;
  }

  convertBlobToBase64 = (blob: Blob) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      resolve(reader.result);
    };
    reader.readAsDataURL(blob);
  });
}
