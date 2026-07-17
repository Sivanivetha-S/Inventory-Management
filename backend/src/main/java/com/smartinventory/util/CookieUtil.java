package com.smartinventory.util;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class CookieUtil {

    @Value("${app.cookie.name:si_auth}")
    private String cookieName;

    @Value("${app.cookie.max-age:86400}")
    private int maxAge;

    @Value("${app.cookie.secure:false}")
    private boolean secure;

    @Value("${app.cookie.path:/}")
    private String path;

    @Value("${app.cookie.same-site:Lax}")
    private String sameSite;

    /** Write the JWT as an HttpOnly cookie on the response. */
    public void setAuthCookie(HttpServletResponse response, String token) {
        Cookie cookie = new Cookie(cookieName, token);
        cookie.setHttpOnly(true);
        cookie.setSecure(secure);
        cookie.setPath(path);
        cookie.setMaxAge(maxAge);
        response.addCookie(cookie);
        // Append SameSite attribute via Set-Cookie header (Java Cookie API doesn't support it directly)
        String header = String.format(
                "%s=%s; Max-Age=%d; Path=%s; HttpOnly; SameSite=%s%s",
                cookieName, token, maxAge, path, sameSite,
                secure ? "; Secure" : "");
        response.setHeader("Set-Cookie", header);
    }

    /** Clear the auth cookie (logout). */
    public void clearAuthCookie(HttpServletResponse response) {
        String header = String.format(
                "%s=; Max-Age=0; Path=%s; HttpOnly; SameSite=%s%s",
                cookieName, path, sameSite,
                secure ? "; Secure" : "");
        response.setHeader("Set-Cookie", header);
    }

    /** Extract the JWT value from the incoming request cookies. Returns null if absent. */
    public String getTokenFromCookie(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) return null;
        for (Cookie c : cookies) {
            if (cookieName.equals(c.getName())) return c.getValue();
        }
        return null;
    }
}
