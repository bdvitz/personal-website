package com.bdvitz.codingstats.party;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.ConcurrentWebSocketSessionDecorator;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.util.Map;

/**
 * JSON protocol for /ws/party. Every message is {@code {type, ...}}.
 * Client to server: hostHello{code,hostToken}, join{code,name}, rejoin{code,token},
 * selectGame{gameId}, start{gameId?}, advance, input{input}, kick{playerId}, setVip{playerId}, resetScores, backToLobby, closeRoom, ping.
 * Server to client: joined{playerId,token,code}, state{...}, error{code,message},
 * closed{message}, kicked, replaced, pong.
 */
@Component
public class PartyHandler extends TextWebSocketHandler {

    private static final Logger logger = LoggerFactory.getLogger(PartyHandler.class);
    private static final String ATTR_OUT = "partyOut";
    private static final int SEND_TIME_LIMIT_MS = 5_000;
    private static final int SEND_BUFFER_LIMIT_BYTES = 64 * 1024;

    private final RoomService roomService;
    private final ObjectMapper objectMapper;

    public PartyHandler(RoomService roomService, ObjectMapper objectMapper) {
        this.roomService = roomService;
        this.objectMapper = objectMapper;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        // Decorated session makes sends thread-safe (ticker thread vs. request threads) and bounds buffering.
        session.getAttributes().put(ATTR_OUT,
                new ConcurrentWebSocketSessionDecorator(session, SEND_TIME_LIMIT_MS, SEND_BUFFER_LIMIT_BYTES));
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        WebSocketSession out = out(session);
        JsonNode msg;
        try {
            msg = objectMapper.readTree(message.getPayload());
        } catch (Exception e) {
            roomService.send(out, error("INVALID", "Bad message"));
            return;
        }
        String type = msg.path("type").asText("");
        try {
            switch (type) {
                case "ping" -> roomService.send(out, Map.of("type", "pong"));
                case "hostHello" -> roomService.hostConnect(out, text(msg, "code"), text(msg, "hostToken"));
                case "join" -> roomService.join(out, text(msg, "code"), text(msg, "name"));
                case "rejoin" -> roomService.rejoin(out, text(msg, "code"), text(msg, "token"));
                case "selectGame" -> roomService.selectGame(out, text(msg, "gameId"));
                case "start" -> roomService.start(out, text(msg, "gameId"));
                case "advance" -> roomService.advance(out);
                case "input" -> roomService.input(out, msg.path("input"));
                case "kick" -> roomService.kick(out, text(msg, "playerId"));
                case "setVip" -> roomService.setVip(out, text(msg, "playerId"));
                case "resetScores" -> roomService.resetScores(out);
                case "backToLobby" -> roomService.backToLobby(out);
                case "closeRoom" -> roomService.closeRoom(out);
                default -> roomService.send(out, error("INVALID", "Unknown message type"));
            }
        } catch (PartyException e) {
            roomService.send(out, error(e.getCode(), e.getMessage()));
        } catch (IllegalArgumentException e) {
            roomService.send(out, error("INVALID_INPUT", e.getMessage()));
        } catch (Exception e) {
            logger.error("Party message '{}' failed", type, e);
            roomService.send(out, error("SERVER_ERROR", "Something went wrong."));
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        roomService.disconnected(out(session));
    }

    private WebSocketSession out(WebSocketSession session) {
        Object out = session.getAttributes().get(ATTR_OUT);
        return out instanceof WebSocketSession decorated ? decorated : session;
    }

    private static String text(JsonNode msg, String field) {
        JsonNode node = msg.get(field);
        return node == null || node.isNull() ? null : node.asText();
    }

    private static Map<String, Object> error(String code, String message) {
        return Map.of("type", "error", "code", code, "message", message == null ? "Error" : message);
    }
}
