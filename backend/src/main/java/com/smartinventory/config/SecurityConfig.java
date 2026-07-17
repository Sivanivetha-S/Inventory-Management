package com.smartinventory.config;

import com.smartinventory.security.JwtAuthFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;
    private final UserDetailsService userDetailsService;

    @org.springframework.beans.factory.annotation.Value("${cors.allowed.origins:http://localhost:5173,http://localhost:3000}")
    private String corsAllowedOriginsRaw;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .csrf(AbstractHttpConfigurer::disable)
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers(
                    "/api/auth/**",
                    "/api/suppliers/register",
                    "/api/suppliers/verify-otp",
                    "/api/suppliers/login",
                    "/api/suppliers/logout",
                    "/uploads/**",             // product images served publicly
                    "/swagger-ui/**",
                    "/swagger-ui.html",
                    "/api-docs/**",
                    "/v3/api-docs/**",
                    "/actuator/**"
                ).permitAll()
                .requestMatchers(org.springframework.http.HttpMethod.POST, "/api/products/**").hasAnyRole("ADMIN", "STAFF")
                .requestMatchers(org.springframework.http.HttpMethod.PUT, "/api/products/**").hasAnyRole("ADMIN", "STAFF")
                .requestMatchers(org.springframework.http.HttpMethod.DELETE, "/api/products/**").hasAnyRole("ADMIN", "STAFF")
                .requestMatchers(org.springframework.http.HttpMethod.GET, "/api/invoices").hasAnyRole("ADMIN", "STAFF")
                .requestMatchers("/api/invoices/report").hasAnyRole("ADMIN", "STAFF")
                .requestMatchers("/api/staff/**").hasRole("ADMIN")
                .requestMatchers("/api/suppliers").hasAnyRole("ADMIN", "SUPPLIER")
                .requestMatchers("/api/suppliers/shops").hasRole("SUPPLIER")
                .requestMatchers("/api/suppliers/**").permitAll()
                .requestMatchers("/api/dashboard/**").hasAnyRole("ADMIN", "STAFF")
                .requestMatchers("/api/branches/**").hasRole("ADMIN")
                .requestMatchers("/api/damage/**").hasAnyRole("ADMIN", "STAFF")
                .requestMatchers("/api/theft-detection/**").hasAnyRole("ADMIN", "STAFF")
                .requestMatchers("/api/supplier-products/my-catalog").hasRole("SUPPLIER")
                .requestMatchers(org.springframework.http.HttpMethod.POST, "/api/supplier-products").hasRole("SUPPLIER")
                .requestMatchers(org.springframework.http.HttpMethod.PUT, "/api/supplier-products/**").hasRole("SUPPLIER")
                .requestMatchers(org.springframework.http.HttpMethod.DELETE, "/api/supplier-products/**").hasRole("SUPPLIER")
                .requestMatchers("/api/supplier-products/**").hasAnyRole("ADMIN", "SUPPLIER")
                .requestMatchers("/api/supplier-dispatch/supplier").hasRole("SUPPLIER")
                .requestMatchers("/api/supplier-dispatch/**").hasAnyRole("ADMIN", "SUPPLIER")
                .requestMatchers("/api/supplier-dispatches/**").hasAnyRole("ADMIN", "SUPPLIER")
                .requestMatchers("/api/supplier-theft/**").hasAnyRole("ADMIN", "SUPPLIER")
                .requestMatchers("/api/supplier-dashboard/**").hasRole("SUPPLIER")
                .requestMatchers("/api/audit-logs/**").hasAnyRole("ADMIN", "SUPPLIER")
                .requestMatchers("/api/supply-requests/status").hasRole("SUPPLIER")
                .requestMatchers("/api/supply-requests/**").hasAnyRole("ADMIN", "SUPPLIER")
                .requestMatchers("/api/owners/**").hasRole("SUPPLIER")
                .requestMatchers("/api/chat/**").hasAnyRole("ADMIN", "STAFF", "SUPPLIER")
                .anyRequest().authenticated()
            )
            .sessionManagement(session ->
                session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authenticationProvider(authenticationProvider())
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        // Split the comma-separated origins from the env/property
        java.util.List<String> origins = java.util.Arrays.stream(corsAllowedOriginsRaw.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .collect(java.util.stream.Collectors.toList());
        configuration.setAllowedOrigins(origins);
        configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("*"));
        // Must be true so the browser sends cookies cross-origin
        configuration.setAllowCredentials(true);
        configuration.setExposedHeaders(List.of("Set-Cookie"));
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }

    @Bean
    public AuthenticationProvider authenticationProvider() {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider();
        provider.setUserDetailsService(userDetailsService);
        provider.setPasswordEncoder(passwordEncoder());
        return provider;
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
