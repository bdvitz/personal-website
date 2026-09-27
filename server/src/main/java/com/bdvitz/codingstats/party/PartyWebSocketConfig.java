package com.bdvitz.codingstats.party;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;
import org.springframework.web.socket.server.standard.ServletServerContainerFactoryBean;

@Configuration
@EnableWebSocket
public class PartyWebSocketConfig implements WebSocketConfigurer {

    /** Clients ping every 25s; a phone that vanished without closing is dropped after this. */
    private static final long SESSION_IDLE_TIMEOUT_MS = 90_000;
    private static final int MAX_MESSAGE_BYTES = 8 * 1024;

    private final PartyHandler partyHandler;

    // The CorsFilter in config/WebConfig doesn't apply to the WebSocket handshake, so reuse its origins here.
    @Value("${cors.allowed.origins}")
    private String allowedOrigins;

    public PartyWebSocketConfig(PartyHandler partyHandler) {
        this.partyHandler = partyHandler;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(partyHandler, "/ws/party")
                .setAllowedOrigins(allowedOrigins.split(","));
    }

    @Bean
    public ServletServerContainerFactoryBean createWebSocketContainer() {
        ServletServerContainerFactoryBean container = new ServletServerContainerFactoryBean();
        container.setMaxTextMessageBufferSize(MAX_MESSAGE_BYTES);
        container.setMaxBinaryMessageBufferSize(MAX_MESSAGE_BYTES);
        container.setMaxSessionIdleTimeout(SESSION_IDLE_TIMEOUT_MS);
        return container;
    }
}
