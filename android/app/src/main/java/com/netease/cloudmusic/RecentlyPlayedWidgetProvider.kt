package com.netease.cloudmusic.widgets

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import com.netease.cloudmusic.R

class RecentlyPlayedWidgetProvider : AppWidgetProvider() {
    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if (intent.action == "com.netease.cloudmusic.RECENTLY_PLAYED_UPDATE") {
            val appWidgetManager = AppWidgetManager.getInstance(context)
            val appWidgetIds = appWidgetManager.getAppWidgetIds(
                android.content.ComponentName(context, RecentlyPlayedWidgetProvider::class.java)
            )
            val titles = intent.getStringArrayExtra("titles") ?: arrayOf("No Recents")

            for (appWidgetId in appWidgetIds) {
                val views = RemoteViews(context.packageName, R.layout.widget_recently_played)
                if (titles.isNotEmpty()) views.setTextViewText(R.id.rec_1_title, titles[0])
                if (titles.size > 1) views.setTextViewText(R.id.rec_2_title, titles[1])
                if (titles.size > 2) views.setTextViewText(R.id.rec_3_title, titles[2])
                appWidgetManager.updateAppWidget(appWidgetId, views)
            }
        }
    }
}