import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'

export async function capturePhoto(): Promise<Blob | null> {
  try {
    const photo = await Camera.getPhoto({
      quality: 85,
      allowEditing: true,
      resultType: CameraResultType.Uri,
      source: CameraSource.Prompt,
      width: 1200,
      height: 1200,
    })

    if (!photo.webPath) return null

    const response = await fetch(photo.webPath)
    return await response.blob()
  } catch {
    // User cancelled or permission denied
    return null
  }
}
