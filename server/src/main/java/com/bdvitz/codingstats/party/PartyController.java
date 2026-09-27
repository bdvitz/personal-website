package com.bdvitz.codingstats.party;

import com.bdvitz.codingstats.party.model.Room;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Room creation and lookup. Everything after that happens over the /ws/party WebSocket.
 * Creation is public, so it is limited by the room cap and a per-IP cooldown.
 */
@RestController
@RequestMapping("/api/party")
@CrossOrigin(origins = "${cors.allowed.origins}")
public class PartyController {

    private final RoomService roomService;

    public PartyController(RoomService roomService) {
        this.roomService = roomService;
    }

    /** Optional body {previousCode, previousHostToken}: closes this browser's previous room first. */
    @PostMapping("/rooms")
    public ResponseEntity<?> createRoom(HttpServletRequest request,
                                        @RequestBody(required = false) Map<String, String> body) {
        try {
            String previousCode = body == null ? null : body.get("previousCode");
            String previousHostToken = body == null ? null : body.get("previousHostToken");
            Room room = roomService.createRoom(clientIp(request), previousCode, previousHostToken);
            return ResponseEntity.ok(Map.of("code", room.getCode(), "hostToken", room.getHostToken()));
        } catch (PartyException e) {
            HttpStatus status = "RATE_LIMITED".equals(e.getCode())
                    ? HttpStatus.TOO_MANY_REQUESTS
                    : HttpStatus.SERVICE_UNAVAILABLE;
            return ResponseEntity.status(status).body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/rooms/{code}")
    public ResponseEntity<?> getRoom(@PathVariable String code) {
        return roomService.describe(code)
                .<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("error", "No room with that code")));
    }

    /** Railway sits behind a proxy, so prefer the first X-Forwarded-For hop. */
    private String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
