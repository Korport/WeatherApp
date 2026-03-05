# Weather Web App

A responsive weather app built with vanilla HTML, CSS, and JavaScript using the OpenWeather APIs and Leaflet.

## Features

- Search weather by city
- Popular city image buttons with local time
- Current conditions (temperature, feels like, humidity, wind, pressure, visibility, cloudiness)
- Local city time shown on the weather card
- 8-day forecast (with daily high/low when available)
- Cloud cover map with animated timelapse controls (play/pause)
- Dynamic weather-themed background image

## Tech Stack

- HTML5
- CSS3
- JavaScript (Vanilla)
- [Leaflet](https://leafletjs.com/) (map UI)
- [OpenWeather API](https://openweathermap.org/api)

## Project Structure

- `index.html` - app markup
- `styles.css` - app styles
- `app.js` - app logic and API calls

## Setup

1. Clone this repository.
2. Open `app.js`.
3. Set your OpenWeather API key:

```js
const OPENWEATHER_API_KEY = "YOUR_KEY_HERE";
```

4. Open `index.html` in a browser, or use a local static server.

## API Notes

- Current weather endpoint: OpenWeather `2.5/weather`
- Daily forecast endpoint: OpenWeather `3.0/onecall`
- Forecast fallback endpoint: OpenWeather `2.5/forecast`
- Cloud map timelapse tries forecast map frames and falls back to current cloud layer if unavailable for your key/plan.

## Deploy to GitHub Pages

1. Push the project to a GitHub repository.
2. In GitHub, open: `Settings` -> `Pages`.
3. Under **Build and deployment**:
   - Source: `Deploy from a branch`
   - Branch: `main` (or your default branch), folder: `/ (root)`
4. Save and wait for deployment.

Your site will be available at:

`https://<your-username>.github.io/<your-repo-name>/`

## Important Security Note

This app uses a client-side API key in `app.js`, which is publicly visible when deployed.

For production use:

- Restrict the key in your OpenWeather dashboard (HTTP referrer/domain restrictions), or
- Move API calls behind a backend/proxy and keep the key server-side.

## Troubleshooting

- If styles/scripts look outdated after deploy, hard refresh (`Ctrl+F5`).
- If 8-day forecast does not appear, your API plan may not include `3.0/onecall`; fallback forecast should still show.
- If cloud timelapse does not animate, the map layer may be unavailable for your key; the app will show static current clouds.
