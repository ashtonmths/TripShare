package app.tripshare.java;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.DatePickerDialog;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ArrayAdapter;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.Toast;
import androidx.browser.customtabs.CustomTabsIntent;
import org.json.JSONArray;
import org.json.JSONObject;
import java.nio.charset.StandardCharsets;
import java.net.HttpURLConnection;
import java.net.URL;
import java.text.NumberFormat;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Calendar;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

public final class MainActivity extends Activity {
    private static final int INK = Color.rgb(17, 23, 20);
    private static final int PAPER = Color.rgb(246, 244, 237);
    private static final int LIME = Color.rgb(200, 245, 90);
    private static final int BLUE = Color.rgb(141, 200, 255);
    private static final int PINK = Color.rgb(255, 159, 178);
    private ApiClient api;
    private SessionStore sessionStore;
    private LinearLayout content, bottom;
    private ScrollView scroller;
    private TextView themeButton;
    private JSONObject user, dashboard, detail, sharedDetail, selectedTrip;
    private JSONArray owned = new JSONArray(), shared = new JSONArray();
    private String selectedId, screen = "home";
    private boolean selectedShared, dark = true;
    private boolean connectingToGoogle, authBrowserLaunched;
    private String rideGroupId, rideDate = LocalDate.now().toString(), rideDirection = "one_way";
    private final Map<String, String> ridePeople = new HashMap<>();
    private long ridePricePaise;
    private String rideQuote;
    private String rideKm = "";
    private EditText rideDistance;
    private LinearLayout ridePeopleArea, ridePreview;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        setContentView(R.layout.activity_main);
        sessionStore = new SessionStore(this);
        api = new ApiClient(sessionStore);
        content = findViewById(R.id.content);
        bottom = findViewById(R.id.bottomBar);
        scroller = findViewById(R.id.scroller);
        themeButton = findViewById(R.id.themeButton);
        dark = getPreferences(MODE_PRIVATE).getBoolean("dark", true);
        themeButton.setOnClickListener(v -> {
            dark = !dark;
            getPreferences(MODE_PRIVATE).edit().putBoolean("dark", dark).apply();
            render();
        });
        nav(R.id.navHome, "home");
        nav(R.id.navTrips, "trips");
        nav(R.id.navRide, "ride");
        nav(R.id.navProfile, "profile");
        showLoading();
        if (getIntent().getData() == null) loadSession();
        else handleDeepLink(getIntent());
    }

    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleDeepLink(intent);
    }

    @Override protected void onResume() {
        super.onResume();
        if (connectingToGoogle && authBrowserLaunched) {
            connectingToGoogle = false;
            authBrowserLaunched = false;
            render();
        }
    }

    private void handleDeepLink(Intent intent) {
        Uri uri = intent == null ? null : intent.getData();
        if (uri == null || !"tripsharejava".equals(uri.getScheme()) || !"auth".equals(uri.getHost())) return;
        connectingToGoogle = false;
        authBrowserLaunched = false;
        String raw = uri.getQueryParameter("cookie");
        intent.setData(null);
        if (raw == null || raw.isEmpty()) {
            render();
            error("Google sign-in did not complete. Please try again.");
            return;
        }
        try {
            java.util.regex.Matcher session = java.util.regex.Pattern.compile(
                    "((?:__Secure-)?better-auth\\.session_token=[^;,\\s]+)").matcher(raw);
            if (!session.find()) {
                render();
                error("Google sign-in did not return a session token");
                return;
            }
            sessionStore.save(session.group(1));
            showGoogleLoading("Signing you in…");
            loadSession();
        } catch (Exception e) {
            render();
            error("Could not save sign-in session");
        }
    }

    private void loadSession() {
        api.session((result, failure) -> {
            JSONObject response = obj(result);
            user = response == null ? null : response.optJSONObject("user");
            if (user == null && failure != null && !sessionStore.read().isEmpty()) error(failure);
            if (user == null) { render(); return; }
            refresh();
        });
    }

    private void signIn() {
        if (connectingToGoogle) return;
        connectingToGoogle = true;
        showGoogleLoading("Connecting to Google…");
        api.auth("sign-in/social", ApiClient.json(
                "provider", "google",
                "callbackURL", "tripsharejava://auth",
                "errorCallbackURL", "tripsharejava://auth"
        ), (result, failure) -> {
            if (failure != null) {
                connectingToGoogle = false;
                render();
                error(failure);
                return;
            }
            String url = str(obj(result), "url");
            if (url.isEmpty()) {
                connectingToGoogle = false;
                render();
                error("Google sign-in could not start");
                return;
            }
            Uri proxy = Uri.parse(BuildConfig.API_BASE_URL + "/api/auth/expo-authorization-proxy")
                    .buildUpon().appendQueryParameter("authorizationURL", url).build();
            try {
                authBrowserLaunched = true;
                new CustomTabsIntent.Builder().setShowTitle(true).build().launchUrl(this, proxy);
            } catch (Exception e) {
                authBrowserLaunched = false;
                connectingToGoogle = false;
                render();
                error("No browser is available for Google sign-in");
            }
        });
    }

    private void signOut() {
        api.auth("sign-out", new JSONObject(), (result, failure) -> {
            sessionStore.clear();
            user = null;
            owned = new JSONArray();
            shared = new JSONArray();
            detail = null;
            sharedDetail = null;
            selectedId = null;
            screen = "home";
            render();
        });
    }

    private void refresh() {
        if (user == null) { render(); return; }
        api.query("groups.list", null, (result, failure) -> {
            if (failure != null) error(failure);
            owned = arr(result);
            api.query("sharedTrips.list", null, (sharedResult, sharedError) -> {
                if (sharedError != null) error(sharedError);
                shared = arr(sharedResult);
                if (selectedId == null) {
                    if (owned.length() > 0) {
                        selectedId = str(owned.optJSONObject(0), "id");
                        selectedShared = false;
                    } else if (shared.length() > 0) {
                        selectedId = str(shared.optJSONObject(0), "groupId");
                        selectedShared = true;
                    }
                }
                loadSelected();
            });
        });
        api.query("dashboard", null, (result, failure) -> {
            dashboard = obj(result);
            if ("home".equals(screen)) render();
        });
    }

    private void loadSelected() {
        if (selectedId == null) { detail = null; sharedDetail = null; render(); return; }
        api.query(selectedShared ? "sharedTrips.detail" : "groups.detail",
                ApiClient.json("groupId", selectedId), (result, failure) -> {
                    if (failure != null) { error(failure); render(); return; }
                    if (selectedShared) { sharedDetail = obj(result); detail = null; }
                    else { detail = obj(result); sharedDetail = null; }
                    render();
                });
    }

    private void nav(int id, String target) {
        findViewById(id).setOnClickListener(v -> {
            screen = target;
            render();
        });
    }

    private void render() {
        int background = dark ? INK : PAPER;
        int foreground = dark ? PAPER : INK;
        findViewById(R.id.root).setBackgroundColor(background);
        findViewById(R.id.topBar).setBackgroundColor(background);
        ((TextView) findViewById(R.id.brand)).setTextColor(foreground);
        themeButton.setText(dark ? "☀" : "☾");
        content.removeAllViews();
        bottom.setVisibility(user == null ? View.GONE : View.VISIBLE);
        bottom.setBackgroundColor(background);
        if (user == null) { renderLogin(); return; }
        int[] navIds = {R.id.navHome, R.id.navTrips, R.id.navRide, R.id.navProfile};
        String[] names = {"home", "trips", "ride", "profile"};
        for (int i = 0; i < navIds.length; i++) {
            TextView item = findViewById(navIds[i]);
            boolean active = screen.equals(names[i]);
            item.setBackgroundColor(active ? LIME : background);
            item.setTextColor(active ? INK : foreground);
        }
        switch (screen) {
            case "trips": renderTrips(); break;
            case "ride": renderRide(); break;
            case "profile": renderProfile(); break;
            default: renderHome();
        }
    }

    private void showLoading() {
        content.removeAllViews();
        heading(content, "TripShare", 32, dark ? PAPER : INK);
        label(content, "Getting your rides ready", dark ? PAPER : INK, 16);
    }

    private void showGoogleLoading(String message) {
        content.removeAllViews();
        bottom.setVisibility(View.GONE);
        spacer(content, 72);
        LinearLayout card = card(content, BLUE);
        heading(card, "TripShare", 31, INK);
        label(card, message, INK, 18);
        label(card, "Keep this app open while Google confirms your account.", INK, 14);
    }

    private void renderLogin() {
        spacer(content, 70);
        LinearLayout card = card(content, BLUE);
        heading(card, "Clear rides. Fair costs.", 37, INK);
        label(card, "Manage a carpool or view trips shared with your Google email.", INK, 17);
        spacer(content, 24);
        button(content, "Continue with Google", LIME, this::signIn);
        label(content, "Partners have read-only access to their trips.", dark ? PAPER : INK, 13);
    }

    private void renderHome() {
        label(content, "Hello, " + str(user, "name"), dark ? PAPER : INK, 15);
        heading(content, "Your TripShare", 30, dark ? PAPER : INK);
        int groupCount = dashboard == null ? owned.length() : dashboard.optInt("groupCount");
        if (groupCount > 0) {
            LinearLayout outstanding = card(content, LIME);
            label(outstanding, "OUTSTANDING", INK, 14);
            heading(outstanding, money(dashboard == null ? 0 : dashboard.optLong("totalOwedPaise")
                    - dashboard.optLong("totalPaidPaise")), 37, INK);
            label(outstanding, (dashboard == null ? 0 : dashboard.optInt("journeyCount"))
                    + " rides · " + groupCount + " owned trips", INK, 15);
        }
        section(content, "Payments");
        boolean anything = false;
        for (int i = 0; i < shared.length(); i++) {
            JSONObject item = shared.optJSONObject(i);
            if (item == null) continue;
            anything = true;
            LinearLayout card = card(content, dark ? INK : PAPER);
            label(card, "Pay " + str(item, "ownerName"), dark ? PAPER : INK, 18);
            label(card, str(item, "groupName") + " · " + str(item, "ownerEmail"), dark ? PAPER : INK, 13);
            heading(card, money(Math.max(0, item.optLong("owedPaise") - item.optLong("paidPaise"))) + " remaining", 22, dark ? PAPER : INK);
            label(card, money(item.optLong("pendingPaymentPaise")) + " awaiting approval", dark ? PAPER : INK, 13);
            card.setOnClickListener(v -> select(str(item, "groupId"), true));
        }
        JSONArray claims = dashboard == null ? new JSONArray() : dashboard.optJSONArray("pendingPaymentClaims");
        JSONArray corrections = dashboard == null ? new JSONArray() : dashboard.optJSONArray("pendingCorrections");
        if (claims != null) for (int i = 0; i < claims.length(); i++) {
            JSONObject item = claims.optJSONObject(i);
            anything = true;
            LinearLayout card = card(content, LIME);
            label(card, "Approval needed · " + str(item, "personName"), INK, 17);
            label(card, money(item.optLong("amountPaise")) + " · " + str(item, "groupName"), INK, 14);
            card.setOnClickListener(v -> select(str(item, "groupId"), false));
        }
        if (corrections != null) for (int i = 0; i < corrections.length(); i++) {
            JSONObject item = corrections.optJSONObject(i);
            anything = true;
            LinearLayout card = card(content, PINK);
            label(card, "Attendance dispute · " + str(item, "personName"), INK, 17);
            card.setOnClickListener(v -> select(str(item, "groupId"), false));
        }
        if (!anything) label(content, "No payments need attention.", dark ? PAPER : INK, 15);
        section(content, "What do you need?");
        button(content, "＋   Record a ride", PINK, () -> { screen = "ride"; render(); });
        button(content, "▣   Manage trips", BLUE, () -> { screen = "trips"; render(); });
        section(content, "Recent rides");
        JSONArray rides = dashboard == null ? null : dashboard.optJSONArray("recentJourneys");
        if (rides == null || rides.length() == 0) label(content, "No recent rides yet.", dark ? PAPER : INK, 15);
        else for (int i = 0; i < rides.length(); i++) {
            JSONObject ride = rides.optJSONObject(i);
            LinearLayout card = card(content, dark ? INK : PAPER);
            label(card, str(ride, "journeyDate") + " · " + str(ride, "distanceKm") + " km", dark ? PAPER : INK, 15);
            label(card, money(ride.optLong("fuelCostPaise")), dark ? PAPER : INK, 19);
        }
    }

    private void select(String id, boolean readOnly) {
        selectedId = id;
        selectedShared = readOnly;
        screen = "trips";
        showLoading();
        loadSelected();
    }

    private void renderTrips() {
        heading(content, "Trips", 30, dark ? PAPER : INK);
        label(content, "People, balances, rides and settings.", dark ? PAPER : INK, 15);
        button(content, "+   New trip", LIME, () -> groupForm(null));
        section(content, "All trips");
        if (owned.length() == 0 && shared.length() == 0) {
            label(content, "Create a trip or ask an owner to add your Google email.", dark ? PAPER : INK, 15);
        }
        for (int i = 0; i < owned.length(); i++) {
            JSONObject trip = owned.optJSONObject(i);
            if (trip != null) button(content, str(trip, "name") + "  ·  Owner", BLUE,
                    () -> select(str(trip, "id"), false));
        }
        for (int i = 0; i < shared.length(); i++) {
            JSONObject trip = shared.optJSONObject(i);
            if (trip != null) button(content, str(trip, "groupName") + "  ·  Read only", LIME,
                    () -> select(str(trip, "groupId"), true));
        }
        if (selectedShared) renderShared();
        else renderOwned();
    }

    private void renderOwned() {
        if (detail == null) return;
        JSONObject group = detail.optJSONObject("group");
        if (group == null) return;
        LinearLayout hero = card(content, BLUE);
        heading(hero, str(group, "name"), 25, INK);
        label(hero, str(group, "vehicleName") + " · " + str(group, "mileageKmpl") + " km/l", INK, 15);
        label(hero, str(group, "normalOneWayKm") + " km one way · " + str(group, "fuelType"), INK, 14);
        button(content, "＋   Add person", PINK, () -> personForm(null));
        button(content, "₹   Record payment", LIME, this::paymentForm);
        button(content, "⚙   Trip settings", BLUE, () -> groupForm(group));
        section(content, "Balances");
        JSONArray people = detail.optJSONArray("people");
        JSONArray balances = detail.optJSONArray("balances");
        if (people != null) for (int i = 0; i < people.length(); i++) {
            JSONObject person = people.optJSONObject(i);
            if (person == null) continue;
            JSONObject balance = find(balances, "personId", str(person, "id"));
            LinearLayout row = card(content, dark ? INK : PAPER);
            label(row, str(person, "name") + "   " + money(balance == null ? 0 : balance.optLong("balancePaise")), dark ? PAPER : INK, 17);
            label(row, (person.isNull("email") ? "Email not set" : str(person, "email")) + " · "
                    + money(balance == null ? 0 : balance.optLong("paidPaise")) + " paid", dark ? PAPER : INK, 13);
            row.setOnClickListener(v -> personForm(person));
        }
        JSONArray corrections = detail.optJSONArray("corrections");
        if (corrections != null) for (int i = 0; i < corrections.length(); i++) {
            JSONObject item = corrections.optJSONObject(i);
            if (item != null && "pending".equals(str(item, "status"))) {
                section(content, "Attendance correction");
                LinearLayout card = card(content, PINK);
                label(card, str(item, "personName") + ": " + str(item, "note"), INK, 16);
                button(card, "Approve", LIME, () -> resolve("corrections.resolve", "correctionId", str(item, "id"), "approved"));
                button(card, "Reject", PAPER, () -> resolve("corrections.resolve", "correctionId", str(item, "id"), "rejected"));
            }
        }
        JSONArray claims = detail.optJSONArray("paymentClaims");
        if (claims != null) for (int i = 0; i < claims.length(); i++) {
            JSONObject item = claims.optJSONObject(i);
            if (item != null && "pending".equals(str(item, "status"))) {
                section(content, "Payment approval");
                LinearLayout card = card(content, LIME);
                label(card, str(item, "personName") + " · " + money(item.optLong("amountPaise")), INK, 16);
                button(card, "Approve", BLUE, () -> resolve("paymentClaims.resolve", "claimId", str(item, "id"), "approved"));
                button(card, "Reject", PAPER, () -> resolve("paymentClaims.resolve", "claimId", str(item, "id"), "rejected"));
            }
        }
        section(content, "Journey history");
        JSONArray journeys = detail.optJSONArray("journeys");
        if (journeys == null || journeys.length() == 0) label(content, "No rides recorded yet.", dark ? PAPER : INK, 15);
        else for (int i = 0; i < journeys.length(); i++) renderJourney(journeys.optJSONObject(i));
    }

    private void renderJourney(JSONObject ride) {
        if (ride == null) return;
        LinearLayout card = card(content, dark ? INK : PAPER);
        label(card, str(ride, "journeyDate") + "   " + money(ride.optLong("fuelCostPaise")), dark ? PAPER : INK, 17);
        label(card, ("two_way".equals(str(ride, "direction")) ? "Return" : "One way")
                + " · " + str(ride, "distanceKm") + " km", dark ? PAPER : INK, 14);
        JSONArray participants = ride.optJSONArray("participants");
        if (participants == null) return;
        for (int i = 0; i < participants.length(); i++) {
            JSONObject person = participants.optJSONObject(i);
            if (person == null) continue;
            label(card, str(person, "name") + " · " + money(person.optLong("sharePaise")), dark ? PAPER : INK, 14);
            if ("two_way".equals(str(ride, "direction"))) {
                button(card, "Change " + str(person, "name") + " route · "
                        + ("two_way".equals(str(person, "direction")) ? "Return" : "One way"), BLUE,
                        () -> new AlertDialog.Builder(this).setTitle("Passenger route")
                                .setItems(new String[]{"One way", "Return"}, (dialog, which) ->
                                        submit("journeys.updateParticipantDirection", ApiClient.json(
                                                "journeyId", str(ride, "id"), "personId", str(person, "personId"),
                                                "direction", which == 0 ? "one_way" : "two_way"), this::loadSelected)).show());
            }
        }
    }

    private void renderShared() {
        if (sharedDetail == null) return;
        LinearLayout hero = card(content, LIME);
        heading(hero, str(sharedDetail, "groupName"), 25, INK);
        label(hero, "Pay " + str(sharedDetail, "ownerName") + " · " + str(sharedDetail, "ownerEmail"), INK, 15);
        label(hero, money(Math.max(0, sharedDetail.optLong("owedPaise") - sharedDetail.optLong("paidPaise"))) + " remaining", INK, 20);
        label(hero, money(sharedDetail.optLong("pendingPaymentPaise")) + " awaiting approval", INK, 13);
        button(content, "₹   Mark payment sent", BLUE, this::claimPaymentForm);
        section(content, "My attendance");
        JSONArray rides = sharedDetail.optJSONArray("journeys");
        if (rides == null || rides.length() == 0) label(content, "No attendance has been recorded for you.", dark ? PAPER : INK, 15);
        else for (int i = 0; i < rides.length(); i++) {
            JSONObject ride = rides.optJSONObject(i);
            LinearLayout card = card(content, dark ? INK : PAPER);
            label(card, str(ride, "journeyDate") + " · " + money(ride.optLong("sharePaise")), dark ? PAPER : INK, 17);
            label(card, ("two_way".equals(str(ride, "direction")) ? "Return" : "One way") + " · " + str(ride, "distanceKm") + " km", dark ? PAPER : INK, 14);
            if (ride.isNull("correctionStatus")) button(card, "I wasn’t there · Raise correction", PINK,
                    () -> correctionForm(str(ride, "id")));
            else label(card, "Correction: " + str(ride, "correctionStatus"), dark ? PAPER : INK, 13);
        }
    }

    private void resolve(String route, String key, String id, String status) {
        submit(route, ApiClient.json("groupId", selectedId, key, id, "status", status), this::loadSelected);
    }

    private void renderProfile() {
        heading(content, "Profile", 30, dark ? PAPER : INK);
        LinearLayout card = card(content, BLUE);
        String photo = str(user, "image");
        if (photo.startsWith("https://")) {
            ImageView avatar = new ImageView(this);
            avatar.setScaleType(ImageView.ScaleType.CENTER_CROP);
            card.addView(avatar, new LinearLayout.LayoutParams(dp(72), dp(72)));
            new Thread(() -> {
                try {
                    HttpURLConnection connection = (HttpURLConnection) new URL(photo).openConnection();
                    connection.setConnectTimeout(8000);
                    connection.setReadTimeout(8000);
                    Bitmap bitmap;
                    try (java.io.InputStream input = connection.getInputStream()) {
                        bitmap = BitmapFactory.decodeStream(input);
                    } finally { connection.disconnect(); }
                    if (bitmap != null) runOnUiThread(() -> avatar.setImageBitmap(bitmap));
                } catch (Exception ignored) { }
            }).start();
        }
        heading(card, str(user, "name"), 26, INK);
        label(card, str(user, "email"), INK, 15);
        button(content, "Edit display name", LIME, this::editName);
        button(content, "Sign out", PINK, this::signOut);
    }

    private void renderRide() {
        heading(content, "Add ride", 30, dark ? PAPER : INK);
        label(content, "Date, route, attendance, fuel price and split.", dark ? PAPER : INK, 15);
        if (owned.length() == 0) {
            label(content, "Create a trip and add a person first.", dark ? PAPER : INK, 15);
            button(content, "Create trip", LIME, () -> { screen = "trips"; render(); groupForm(null); });
            return;
        }
        if (rideGroupId == null) rideGroupId = str(owned.optJSONObject(0), "id");
        section(content, "1 · Trip");
        List<String> names = new ArrayList<>();
        int selectedPosition = 0;
        for (int i = 0; i < owned.length(); i++) {
            JSONObject group = owned.optJSONObject(i);
            names.add(str(group, "name"));
            if (rideGroupId.equals(str(group, "id"))) selectedPosition = i;
        }
        Spinner groups = spinner(content, names, selectedPosition);
        groups.setOnItemSelectedListener(new SimpleSelection(position -> {
            String next = str(owned.optJSONObject(position), "id");
            if (!next.equals(rideGroupId)) {
                rideGroupId = next;
                ridePeople.clear();
                ridePricePaise = 0;
                rideQuote = null;
                rideKm = "";
                api.query("groups.detail", ApiClient.json("groupId", next), (result, failure) -> {
                    if (failure != null) { error(failure); return; }
                    detail = obj(result);
                    selectedId = next;
                    selectedShared = false;
                    render();
                });
            }
        }));
        JSONObject group = detail == null ? null : detail.optJSONObject("group");
        if (group == null || !rideGroupId.equals(str(group, "id"))) {
            label(content, "Loading people…", dark ? PAPER : INK, 15);
            api.query("groups.detail", ApiClient.json("groupId", rideGroupId), (result, failure) -> {
                if (failure == null) { detail = obj(result); render(); }
                else error(failure);
            });
            return;
        }
        section(content, "2 · Date");
        button(content, rideDate + "   ▣", BLUE, () -> pickDate(rideDate, value -> {
            rideDate = value;
            render();
        }));
        section(content, "3 · Route");
        Spinner direction = spinner(content, Arrays.asList("One way", "Return"), "two_way".equals(rideDirection) ? 1 : 0);
        direction.setOnItemSelectedListener(new SimpleSelection(position -> {
            String next = position == 0 ? "one_way" : "two_way";
            if (!next.equals(rideDirection)) {
                rideDirection = next;
                ridePeople.clear();
                ridePricePaise = 0;
                rideQuote = null;
                rideKm = "";
                render();
            }
        }));
        rideDistance = input(content, "Distance (km)", !rideKm.isEmpty() ? rideKm :
                ("two_way".equals(rideDirection)
                        ? String.valueOf(group.optDouble("normalOneWayKm") * 2)
                        : str(group, "normalOneWayKm")), true);
        rideDistance.addTextChangedListener(new android.text.TextWatcher() {
            @Override public void beforeTextChanged(CharSequence text, int start, int count, int after) { }
            @Override public void onTextChanged(CharSequence text, int start, int before, int count) {
                rideKm = text.toString();
                updatePreview();
            }
            @Override public void afterTextChanged(android.text.Editable text) { }
        });
        section(content, "4 · Who joined?");
        ridePeopleArea = new LinearLayout(this);
        ridePeopleArea.setOrientation(LinearLayout.VERTICAL);
        content.addView(ridePeopleArea);
        renderRidePeople();
        section(content, "5 · Fuel price");
        LinearLayout fuelCard = card(content, BLUE);
        label(fuelCard, str(group, "fuelDistrict") + " " + str(group, "fuelType"), INK, 17);
        label(fuelCard, ridePricePaise > 0 ? money(ridePricePaise) + " / litre" : "Fetch the current price", INK, 14);
        button(fuelCard, "Fetch live price", LIME, () -> api.query("fuel.current", ApiClient.json("groupId", rideGroupId), (result, failure) -> {
            if (failure != null) { error(failure + ". Enter a manual price."); return; }
            JSONObject quote = obj(result);
            ridePricePaise = quote == null ? 0 : quote.optLong("pricePaise");
            rideQuote = str(quote, "quoteToken");
            render();
        }));
        button(fuelCard, "Enter price manually", PAPER, () -> {
            EditText amount = new EditText(this);
            amount.setInputType(8194);
            amount.setHint("₹ per litre");
            new AlertDialog.Builder(this).setTitle("Manual fuel price").setView(amount)
                    .setNegativeButton("Cancel", null).setPositiveButton("Use price", (dialog, which) -> {
                        try {
                            ridePricePaise = Math.round(Double.parseDouble(amount.getText().toString()) * 100);
                            if (ridePricePaise <= 0) throw new NumberFormatException();
                            rideQuote = null;
                            render();
                        } catch (NumberFormatException e) { error("Enter a valid price"); }
                    }).show();
        });
        ridePreview = new LinearLayout(this);
        ridePreview.setOrientation(LinearLayout.VERTICAL);
        content.addView(ridePreview);
        updatePreview();
        button(content, "Save ride", LIME, this::saveRide);
    }

    private void renderRidePeople() {
        ridePeopleArea.removeAllViews();
        JSONArray people = detail == null ? null : detail.optJSONArray("people");
        if (people == null || people.length() == 0) {
            label(ridePeopleArea, "Add a person from Trips first.", dark ? PAPER : INK, 15);
            return;
        }
        for (int i = 0; i < people.length(); i++) {
            JSONObject person = people.optJSONObject(i);
            if (person == null || person.optInt("isActive", 1) == 0) continue;
            String id = str(person, "id");
            LinearLayout row = card(ridePeopleArea, ridePeople.containsKey(id) ? LIME : (dark ? INK : PAPER));
            label(row, (ridePeople.containsKey(id) ? "✓  " : "○  ") + str(person, "name"),
                    ridePeople.containsKey(id) ? INK : (dark ? PAPER : INK), 16);
            row.setOnClickListener(v -> {
                if (ridePeople.containsKey(id)) ridePeople.remove(id);
                else ridePeople.put(id, rideDirection);
                renderRidePeople();
                updatePreview();
            });
            if (ridePeople.containsKey(id) && "two_way".equals(rideDirection)) {
                Spinner route = spinner(row, Arrays.asList("One way", "Return"),
                        "two_way".equals(ridePeople.get(id)) ? 1 : 0);
                route.setOnItemSelectedListener(new SimpleSelection(position -> {
                    ridePeople.put(id, position == 0 ? "one_way" : "two_way");
                    updatePreview();
                }));
            }
        }
    }

    private long fuelCost() {
        try {
            double km = Double.parseDouble(rideDistance.getText().toString());
            double mileage = Double.parseDouble(str(detail.optJSONObject("group"), "mileageKmpl"));
            if (km <= 0 || mileage <= 0) return 0;
            return Math.round(km / mileage * ridePricePaise);
        } catch (Exception e) { return 0; }
    }

    private Map<String, Long> shares(long total) {
        Map<String, Long> result = new HashMap<>();
        int weight = 0;
        for (String direction : ridePeople.values()) weight += "two_way".equals(direction) ? 2 : 1;
        if (weight == 0) return result;
        long assigned = 0;
        int index = 0;
        for (Map.Entry<String, String> entry : ridePeople.entrySet()) {
            long amount = index == ridePeople.size() - 1 ? total - assigned
                    : total * ("two_way".equals(entry.getValue()) ? 2 : 1) / weight;
            result.put(entry.getKey(), amount);
            assigned += amount;
            index++;
        }
        return result;
    }

    private void updatePreview() {
        if (ridePreview == null) return;
        ridePreview.removeAllViews();
        if (ridePricePaise <= 0 || ridePeople.isEmpty()) return;
        LinearLayout card = card(ridePreview, PINK);
        heading(card, "Total " + money(fuelCost()), 22, INK);
        Map<String, Long> split = shares(fuelCost());
        JSONArray people = detail.optJSONArray("people");
        for (String id : split.keySet()) {
            JSONObject person = find(people, "id", id);
            label(card, str(person, "name") + " · " + money(split.get(id)), INK, 15);
        }
    }

    private void saveRide() {
        if (ridePeople.isEmpty() || ridePricePaise <= 0 || fuelCost() <= 0) {
            error("Choose passengers, distance and a fuel price"); return;
        }
        JSONArray ids = new JSONArray();
        JSONArray directions = new JSONArray();
        for (Map.Entry<String, String> entry : ridePeople.entrySet()) {
            ids.put(entry.getKey());
            directions.put(ApiClient.json("personId", entry.getKey(), "direction", entry.getValue()));
        }
        JSONObject data = ApiClient.json("groupId", rideGroupId, "journeyDate", rideDate,
                "direction", rideDirection, "distanceKm", Double.parseDouble(rideDistance.getText().toString()),
                "participantIds", ids, "participantDirections", directions,
                "petrolPricePaise", ridePricePaise,
                "petrolPriceSource", rideQuote == null ? "manual" : "mypetrolprice");
        if (rideQuote != null) {
            try { data.put("fuelQuoteToken", rideQuote); }
            catch (Exception e) { error("Could not prepare fuel quote"); return; }
        }
        submit("journeys.create", data, () -> {
            ridePeople.clear();
            ridePricePaise = 0;
            rideQuote = null;
            rideKm = "";
            refresh();
        });
    }

    private void personForm(JSONObject existing) {
        Form form = form(existing == null ? "Add a person" : "Edit person");
        EditText name = input(form.body, "Name", str(existing, "name"), false);
        EditText email = input(form.body, "Google email (optional)", str(existing, "email"), false);
        EditText phone = input(form.body, "Phone (optional)", str(existing, "phone"), false);
        label(form.body, "A matching Google account receives read-only access.", INK, 13);
        if (existing != null) button(form.body, existing.optInt("isActive", 1) == 1 ? "Deactivate person" : "Reactivate person",
                PINK, () -> submit("people.setActive", ApiClient.json("groupId", selectedId,
                        "personId", str(existing, "id"), "active", existing.optInt("isActive", 1) != 1),
                        () -> { form.dialog.dismiss(); loadSelected(); }));
        form.save(() -> {
            if (name.getText().toString().trim().length() < 2) { error("Enter a name"); return; }
            JSONObject data = ApiClient.json("groupId", selectedId, "name", name.getText().toString().trim(),
                    "email", email.getText().toString().trim(), "phone", phone.getText().toString().trim());
            if (existing != null) {
                try { data.put("personId", str(existing, "id")); }
                catch (Exception e) { error("Could not prepare person details"); return; }
            }
            submit(existing == null ? "people.add" : "people.updateContact", data, this::loadSelected);
            form.dialog.dismiss();
        });
    }

    private void paymentForm() {
        JSONArray people = detail.optJSONArray("people");
        if (people == null || people.length() == 0) { error("Add a person first"); return; }
        Form form = form("Record payment");
        List<String> names = new ArrayList<>();
        for (int i = 0; i < people.length(); i++) names.add(str(people.optJSONObject(i), "name"));
        label(form.body, "Person", INK, 14);
        Spinner person = spinner(form.body, names, 0);
        EditText amount = input(form.body, "Amount (₹)", "", true);
        label(form.body, "Method", INK, 14);
        Spinner method = spinner(form.body, Arrays.asList("UPI", "Cash", "Bank transfer", "Other"), 0);
        final String[] date = {LocalDate.now().toString()};
        final TextView[] dateButton = {null};
        dateButton[0] = button(form.body, "Paid on · " + date[0], BLUE, () -> pickDate(date[0], value -> {
            date[0] = value;
            dateButton[0].setText("Paid on · " + value);
        }));
        EditText note = input(form.body, "Note (optional)", "", false);
        form.save(() -> {
            try {
                long paise = Math.round(Double.parseDouble(amount.getText().toString()) * 100);
                if (paise <= 0) throw new NumberFormatException();
                String[] methods = {"upi", "cash", "bank_transfer", "other"};
                submit("payments.create", ApiClient.json("groupId", selectedId,
                        "personId", str(people.optJSONObject(person.getSelectedItemPosition()), "id"),
                        "amountPaise", paise, "method", methods[method.getSelectedItemPosition()],
                        "paidOn", date[0], "note", note.getText().toString().trim()), this::loadSelected);
                form.dialog.dismiss();
            } catch (NumberFormatException e) { error("Enter a valid amount"); }
        });
    }

    private void claimPaymentForm() {
        Form form = form("Mark payment sent");
        EditText amount = input(form.body, "Amount (₹)", "", true);
        label(form.body, "Method", INK, 14);
        Spinner method = spinner(form.body, Arrays.asList("UPI", "Cash", "Bank transfer", "Other"), 0);
        final String[] date = {LocalDate.now().toString()};
        final TextView[] dateButton = {null};
        dateButton[0] = button(form.body, "Paid on · " + date[0], BLUE, () -> pickDate(date[0], value -> {
            date[0] = value;
            dateButton[0].setText("Paid on · " + value);
        }));
        EditText note = input(form.body, "Note (optional)", "", false);
        form.save(() -> {
            try {
                long paise = Math.round(Double.parseDouble(amount.getText().toString()) * 100);
                if (paise <= 0) throw new NumberFormatException();
                String[] methods = {"upi", "cash", "bank_transfer", "other"};
                submit("sharedTrips.claimPayment", ApiClient.json("groupId", selectedId,
                        "amountPaise", paise, "method", methods[method.getSelectedItemPosition()],
                        "paidOn", date[0], "note", note.getText().toString().trim()), this::loadSelected);
                form.dialog.dismiss();
            } catch (NumberFormatException e) { error("Enter a valid amount"); }
        });
    }

    private void correctionForm(String journeyId) {
        Form form = form("Raise attendance correction");
        EditText note = input(form.body, "What needs correcting?", "I did not join this journey.", false);
        form.save(() -> {
            submit("sharedTrips.raiseCorrection", ApiClient.json("journeyId", journeyId,
                    "note", note.getText().toString().trim()), this::loadSelected);
            form.dialog.dismiss();
        });
    }

    private void groupForm(JSONObject existing) {
        Form form = form(existing == null ? "New trip" : "Trip settings");
        EditText name = null;
        EditText vehicle = null;
        final String[] start = {LocalDate.now().toString()};
        if (existing == null) {
            name = input(form.body, "Trip name", "", false);
            vehicle = input(form.body, "Vehicle", "", false);
            final TextView[] startButton = {null};
            startButton[0] = button(form.body, "Tracking start date · " + start[0], BLUE,
                    () -> pickDate(start[0], value -> {
                        start[0] = value;
                        startButton[0].setText("Tracking start date · " + value);
                    }));
        }
        EditText mileage = input(form.body, "Mileage (km/l)", str(existing, "mileageKmpl"), true);
        EditText distance = input(form.body, "One-way distance (km)", str(existing, "normalOneWayKm"), true);
        label(form.body, "Fuel type", INK, 14);
        Spinner fuel = spinner(form.body, Arrays.asList("Petrol", "Diesel"),
                "diesel".equals(str(existing, "fuelType")) ? 1 : 0);
        label(form.body, "State", INK, 14);
        Spinner states = spinner(form.body, Arrays.asList("Loading states…"), 0);
        label(form.body, "District / city", INK, 14);
        Spinner districts = spinner(form.body, Arrays.asList("Select state first"), 0);
        final JSONArray[] stateRows = {new JSONArray()}, districtRows = {new JSONArray()};
        final String[] stateName = {str(existing, "fuelState")},
                districtName = {str(existing, "fuelDistrict")};
        final int[] locationId = {existing == null ? 0 : existing.optInt("fuelLocationId")};
        api.query("fuel.states", null, (result, failure) -> {
            if (failure != null) { error(failure); return; }
            stateRows[0] = arr(result);
            List<String> labels = new ArrayList<>();
            int initial = 0;
            for (int i = 0; i < stateRows[0].length(); i++) {
                JSONObject item = stateRows[0].optJSONObject(i);
                labels.add(str(item, "name"));
                if (stateName[0].equals(str(item, "name"))) initial = i;
            }
            fillSpinner(states, labels, initial);
            states.setOnItemSelectedListener(new SimpleSelection(position -> {
                JSONObject choice = stateRows[0].optJSONObject(position);
                String next = str(choice, "name");
                if (!next.equals(stateName[0])) {
                    stateName[0] = next;
                    districtName[0] = "";
                    locationId[0] = 0;
                }
                if (choice == null) return;
                fillSpinner(districts, Arrays.asList("Loading districts…"), 0);
                api.query("fuel.districts", ApiClient.json("stateId", choice.optInt("id"),
                        "stateSlug", str(choice, "slug")), (districtResult, districtFailure) -> {
                    if (districtFailure != null) { error(districtFailure); return; }
                    districtRows[0] = arr(districtResult);
                    List<String> districtLabels = new ArrayList<>();
                    districtLabels.add("Select district");
                    int selected = 0;
                    for (int i = 0; i < districtRows[0].length(); i++) {
                        JSONObject item = districtRows[0].optJSONObject(i);
                        districtLabels.add(str(item, "name"));
                        if (districtName[0].equals(str(item, "name"))) selected = i + 1;
                    }
                    fillSpinner(districts, districtLabels, selected);
                    districts.setOnItemSelectedListener(new SimpleSelection(districtPosition -> {
                        if (districtPosition == 0) { districtName[0] = ""; locationId[0] = 0; return; }
                        JSONObject item = districtRows[0].optJSONObject(districtPosition - 1);
                        districtName[0] = str(item, "name");
                        locationId[0] = item == null ? 0 : item.optInt("id");
                    }));
                });
            }));
        });
        EditText finalName = name;
        EditText finalVehicle = vehicle;
        form.save(() -> {
            try {
                double kmpl = Double.parseDouble(mileage.getText().toString());
                double km = Double.parseDouble(distance.getText().toString());
                if (kmpl <= 0 || km <= 0 || locationId[0] <= 0) throw new NumberFormatException();
                JSONObject values = ApiClient.json("mileageKmpl", kmpl,
                        "normalOneWayKm", km, "fuelType", fuel.getSelectedItemPosition() == 0 ? "petrol" : "diesel",
                        "fuelState", stateName[0], "fuelDistrict", districtName[0],
                        "fuelLocationId", locationId[0]);
                if (existing == null) {
                    if (finalName.getText().toString().trim().length() < 2 ||
                            finalVehicle.getText().toString().trim().length() < 2) {
                        error("Enter a trip and vehicle name"); return;
                    }
                    values.put("name", finalName.getText().toString().trim());
                    values.put("vehicleName", finalVehicle.getText().toString().trim());
                    values.put("startDate", start[0]);
                } else values.put("groupId", selectedId);
                submit(existing == null ? "groups.create" : "groups.updateSettings", values, this::refresh);
                form.dialog.dismiss();
            } catch (Exception e) { error("Complete mileage, distance, state and district"); }
        });
    }

    private interface DateResult { void accept(String date); }
    private void pickDate(String initial, DateResult result) {
        LocalDate day;
        try { day = LocalDate.parse(initial); } catch (Exception e) { day = LocalDate.now(); }
        DatePickerDialog picker = new DatePickerDialog(this, (view, year, month, date) ->
                result.accept(String.format(Locale.ROOT, "%04d-%02d-%02d", year, month + 1, date)),
                day.getYear(), day.getMonthValue() - 1, day.getDayOfMonth());
        picker.getDatePicker().setMaxDate(System.currentTimeMillis());
        picker.show();
    }

    private Form form(String title) {
        ScrollView view = (ScrollView) getLayoutInflater().inflate(R.layout.dialog_form, null);
        LinearLayout body = view.findViewById(R.id.formContent);
        AlertDialog dialog = new AlertDialog.Builder(this).setView(view).create();
        heading(body, title, 24, INK);
        dialog.show();
        dialog.getWindow().setLayout(getResources().getDisplayMetrics().widthPixels - dp(24), -2);
        return new Form(dialog, body);
    }

    private final class Form {
        final AlertDialog dialog;
        final LinearLayout body;
        Form(AlertDialog dialog, LinearLayout body) { this.dialog = dialog; this.body = body; }
        void save(Runnable action) { button(body, "Save", LIME, action); }
    }

    private EditText input(LinearLayout parent, String title, String value, boolean decimal) {
        label(parent, title, parent == content ? (dark ? PAPER : INK) : INK, 14);
        EditText field = new EditText(this);
        field.setSingleLine(true);
        field.setText(value);
        field.setTextColor(INK);
        field.setHintTextColor(Color.DKGRAY);
        field.setTextSize(16);
        if (decimal) field.setInputType(8194);
        field.setPadding(dp(12), dp(11), dp(12), dp(11));
        field.setBackgroundResource(R.drawable.border);
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(-1, -2);
        params.setMargins(0, 0, 0, dp(10));
        parent.addView(field, params);
        return field;
    }

    private Spinner spinner(LinearLayout parent, List<String> labels, int selected) {
        Spinner spinner = new Spinner(this);
        spinner.setBackgroundResource(R.drawable.border);
        fillSpinner(spinner, labels, selected);
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(-1, dp(52));
        params.setMargins(0, dp(4), 0, dp(12));
        parent.addView(spinner, params);
        return spinner;
    }

    private void fillSpinner(Spinner spinner, List<String> labels, int selected) {
        ArrayAdapter<String> adapter = new ArrayAdapter<>(this,
                android.R.layout.simple_spinner_dropdown_item, labels);
        spinner.setAdapter(adapter);
        if (!labels.isEmpty()) spinner.setSelection(Math.min(selected, labels.size() - 1));
    }

    private interface SelectionResult { void accept(int position); }
    private static final class SimpleSelection implements android.widget.AdapterView.OnItemSelectedListener {
        private final SelectionResult result;
        SimpleSelection(SelectionResult result) { this.result = result; }
        @Override public void onItemSelected(android.widget.AdapterView<?> parent, View view, int position, long id) {
            result.accept(position);
        }
        @Override public void onNothingSelected(android.widget.AdapterView<?> parent) { }
    }

    private void editName() {
        EditText input = new EditText(this);
        input.setSingleLine(true);
        input.setText(str(user, "name"));
        new AlertDialog.Builder(this).setTitle("Display name").setView(input)
                .setNegativeButton("Cancel", null).setPositiveButton("Save", (d, w) -> {
                    String name = input.getText().toString().trim();
                    if (name.length() < 2) { error("Enter at least two characters"); return; }
                    api.auth("update-user", ApiClient.json("name", name), (result, failure) -> {
                        if (failure != null) error(failure);
                        else loadSession();
                    });
                }).show();
    }

    private void submit(String route, JSONObject data, Runnable success) {
        api.mutate(route, data, (result, failure) -> {
            if (failure != null) error(failure);
            else { Toast.makeText(this, "Saved", Toast.LENGTH_SHORT).show(); success.run(); }
        });
    }

    private void error(String message) {
        Toast.makeText(this, message == null ? "Something went wrong" : message, Toast.LENGTH_LONG).show();
    }

    private static JSONObject obj(Object value) { return value instanceof JSONObject ? (JSONObject) value : null; }
    private static JSONArray arr(Object value) { return value instanceof JSONArray ? (JSONArray) value : new JSONArray(); }
    private static String str(JSONObject object, String key) {
        return object == null || object.isNull(key) ? "" : object.optString(key, "");
    }
    private static JSONObject find(JSONArray items, String key, String value) {
        if (items == null) return null;
        for (int i = 0; i < items.length(); i++) {
            JSONObject item = items.optJSONObject(i);
            if (value.equals(str(item, key))) return item;
        }
        return null;
    }
    private static String money(long paise) {
        NumberFormat currency = NumberFormat.getCurrencyInstance(new Locale("en", "IN"));
        currency.setCurrency(java.util.Currency.getInstance("INR"));
        return currency.format(paise / 100.0);
    }

    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }
    private void spacer(LinearLayout parent, int height) {
        View view = new View(this);
        parent.addView(view, new LinearLayout.LayoutParams(1, dp(height)));
    }
    private void label(LinearLayout parent, String value, int color, int size) {
        TextView view = new TextView(this);
        view.setText(value);
        view.setTextColor(color);
        view.setTextSize(size);
        view.setPadding(0, dp(4), 0, dp(4));
        parent.addView(view);
    }
    private void heading(LinearLayout parent, String value, int size, int color) {
        TextView view = new TextView(this);
        view.setText(value);
        view.setTextColor(color);
        view.setTextSize(size);
        view.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        view.setPadding(0, dp(5), 0, dp(5));
        parent.addView(view);
    }
    private void section(LinearLayout parent, String title) {
        spacer(parent, 19);
        heading(parent, title, 22, dark ? PAPER : INK);
    }
    private LinearLayout card(LinearLayout parent, int color) {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(dp(17), dp(16), dp(17), dp(16));
        GradientDrawable shape = new GradientDrawable();
        shape.setColor(color);
        shape.setStroke(dp(2), dark ? PAPER : INK);
        card.setBackground(shape);
        card.setElevation(dp(4));
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(-1, -2);
        params.setMargins(0, dp(10), 0, dp(6));
        parent.addView(card, params);
        return card;
    }
    private TextView button(LinearLayout parent, String title, int color, Runnable action) {
        TextView button = new TextView(this);
        button.setText(title);
        button.setTextColor(INK);
        button.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        button.setTextSize(16);
        button.setGravity(Gravity.CENTER_VERTICAL);
        button.setPadding(dp(15), dp(13), dp(15), dp(13));
        GradientDrawable shape = new GradientDrawable();
        shape.setColor(color);
        shape.setStroke(dp(2), INK);
        button.setBackground(shape);
        button.setElevation(dp(3));
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(-1, -2);
        params.setMargins(0, dp(7), 0, dp(5));
        parent.addView(button, params);
        button.setOnClickListener(v -> action.run());
        return button;
    }
}
