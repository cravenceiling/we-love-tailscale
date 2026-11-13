import type { Tweet } from "react-tweet/api";

export default {
  "__typename": "Tweet",
  "favorite_count": 36,
  "lang": "en",
  "possibly_sensitive": false,
  "created_at": "2022-10-20T18:02:08.000Z",
  "display_text_range": [
    0,
    231
  ],
  "entities": {
    "urls": [
      {
        "display_url": "tailscale.com/blog/magicdns/",
        "expanded_url": "https://tailscale.com/blog/magicdns/",
        "indices": [
          208,
          231
        ],
        "url": "https://t.co/YmN2xUK4T3"
      }
    ],
    "user_mentions": [
      {
        "id_str": "1106616565573844992",
        "indices": [
          34,
          44
        ],
        "name": "Tailscale",
        "screen_name": "Tailscale"
      },
      {
        "id_str": "395367768",
        "indices": [
          48,
          57
        ],
        "name": "Abby Cabunoc Mayes",
        "screen_name": "abbycabs"
      }
    ]
  },
  "id_str": "1583156629163282433",
  "text": "I'm currently waxing poetic about @Tailscale to @abbycabs on Slack and it turns out MagicDNS, one of the best parts of Tailscale, hit GA today! Congrats to the whole team and thank you for everything you do! https://t.co/YmN2xUK4T3",
  "user": {
    "id_str": "9866582",
    "name": "Christina Warren",
    "screen_name": "film_girl",
    "is_blue_verified": true,
    "profile_image_shape": "Circle",
    "verified": false,
    "profile_image_url_https": "https://pbs.twimg.com/profile_images/1812573605877764097/HuPNMdOy_normal.jpg"
  },
  "edit_control": {
    "edit_tweet_ids": [
      "1583156629163282433"
    ],
    "editable_until_msecs": "1666290728000",
    "edits_remaining": "5",
    "is_edit_eligible": true
  },
  "conversation_count": 2,
  "news_action_type": "conversation",
  "isEdited": false,
  "isStaleEdit": false
} satisfies Omit<Tweet, "entities"> & { entities: Partial<NonNullable<Tweet["entities"]>> };
