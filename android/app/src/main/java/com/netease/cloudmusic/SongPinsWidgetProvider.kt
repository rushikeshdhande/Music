package com.netease.cloudmusic.widgets

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import com.netease.cloudmusic.R

class SongPinsWidgetProvider : AppWidgetProvider() {
    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if (intent.action == "com.netease.cloudmusic.SONG_PINS_UPDATE") {
            val appWidgetManager = AppWidgetManager.getInstance(context)
            val appWidgetIds = appWidgetManager.getAppWidgetIds(
                android.content.ComponentName(context, SongPinsWidgetProvider::class.java)
            )
            val titles = intent.getStringArrayExtra("titles") ?: arrayOf("No Pinned Songs")

            for (appWidgetId in appWidgetIds) {
                val views = RemoteViews(context.packageName, R.layout.widget_song_pins)
                if (titles.isNotEmpty()) views.setTextViewText(R.id.pin_1_title, titles[0])
                if (titles.size > 1) views.setTextViewText(R.id.pin_2_title, titles[1])
                if (titles.size > 2) views.setTextViewText(R.id.pin_3_title, titles[2])
                appWidgetManager.updateAppWidget(appWidgetId, views)
            }
        }
    }
}