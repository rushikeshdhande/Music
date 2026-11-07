
package com.netease.cloudmusic.widgets

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import com.netease.cloudmusic.R

class NowPlayingWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        for (appWidgetId in appWidgetIds) {
            val views = RemoteViews(
                context.packageName,
                R.layout.widget_now_playing
            )
            appWidgetManager.updateAppWidget(appWidgetId, views)
        }
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)

        if (intent.action == "com.netease.cloudmusic.NOW_PLAYING_UPDATE") {
            val appWidgetManager = AppWidgetManager.getInstance(context)

            val appWidgetIds = appWidgetManager.getAppWidgetIds(
                android.content.ComponentName(
                    context,
                    NowPlayingWidgetProvider::class.java
                )
            )

            val title = intent.getStringExtra("title") ?: "Not Playing"
            val artist = intent.getStringExtra("artist") ?: "Unknown"
            val isPlaying = intent.getBooleanExtra("isPlaying", false)

            for (appWidgetId in appWidgetIds) {
                val views = RemoteViews(
                    context.packageName,
                    R.layout.widget_now_playing
                )

                views.setTextViewText(R.id.widget_title, title)
                views.setTextViewText(R.id.widget_artist, artist)

                val playIcon = if (isPlaying) {
                    android.R.drawable.ic_media_pause
                } else {
                    android.R.drawable.ic_media_play
                }

                views.setImageViewResource(
                    R.id.widget_btn_play_pause,
                    playIcon
                )

                val playIntent = Intent(
                    context,
                    NowPlayingWidgetProvider::class.java
                ).apply {
                    action = "com.netease.cloudmusic.ACTION_PLAY_PAUSE"
                }

                val pendingIntent = PendingIntent.getBroadcast(
                    context,
                    0,
                    playIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT or
                        PendingIntent.FLAG_IMMUTABLE
                )

                views.setOnClickPendingIntent(
                    R.id.widget_btn_play_pause,
                    pendingIntent
                )

                appWidgetManager.updateAppWidget(appWidgetId, views)
            }
        }
    }
}
