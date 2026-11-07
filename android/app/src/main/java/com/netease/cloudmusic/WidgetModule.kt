package com.netease.cloudmusic.widgets

import android.content.Intent
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray

class WidgetModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    override fun getName() = "WidgetModule"

      @ReactMethod
    fun updateNowPlaying(title: String, artist: String, isPlaying: Boolean, colorHex: String, albumArtUri: String) {
        val intent = Intent("com.netease.cloudmusic.NOW_PLAYING_UPDATE")
        intent.setPackage(reactApplicationContext.packageName)
        intent.putExtra("title", title)
        intent.putExtra("artist", artist)
        intent.putExtra("isPlaying", isPlaying)
        intent.putExtra("colorHex", colorHex)
        intent.putExtra("albumArtUri", albumArtUri)
        reactApplicationContext.sendBroadcast(intent)
    }

    @ReactMethod
    fun updateSongPins(titles: ReadableArray) {
        val intent = Intent("com.netease.cloudmusic.SONG_PINS_UPDATE")
        intent.setPackage(reactApplicationContext.packageName)
        val array = Array(titles.size()) { i -> titles.getString(i) ?: "" }
        intent.putExtra("titles", array)
        reactApplicationContext.sendBroadcast(intent)
    }

    @ReactMethod
    fun updateRecentlyPlayed(titles: ReadableArray) {
        val intent = Intent("com.netease.cloudmusic.RECENTLY_PLAYED_UPDATE")
        intent.setPackage(reactApplicationContext.packageName)
        val array = Array(titles.size()) { i -> titles.getString(i) ?: "" }
        intent.putExtra("titles", array)
        reactApplicationContext.sendBroadcast(intent)
    }
}