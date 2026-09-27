package com.bdvitz.codingstats.party;

/** Expected, user-facing failure (bad code, name taken, room full...). The message is shown in the UI. */
public class PartyException extends RuntimeException {

    private final String code;

    public PartyException(String code, String message) {
        super(message);
        this.code = code;
    }

    public String getCode() {
        return code;
    }
}
