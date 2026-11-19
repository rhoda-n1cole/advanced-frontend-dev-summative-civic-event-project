/**
 * config.js – global settings for the CivicEvents frontend.
 * Change API_BASE if your backend runs on another host/port.
 */
const CONFIG = {
  API_BASE: 'http://localhost:4000',
  // Upload limits (match backend/src/middlewares/upload.middleware.js)
  UPLOADS: {
    image: { maxMB: 2, ext: ['jpg', 'jpeg', 'png', 'gif'] },
    audio: { maxMB: 5, ext: ['mp3', 'wav', 'm4a', 'ogg'] },
    video: { maxMB: 8, ext: ['mp4', 'mov', 'avi', 'mkv'] },
  },
  PAGE_SIZE: 9,
};
