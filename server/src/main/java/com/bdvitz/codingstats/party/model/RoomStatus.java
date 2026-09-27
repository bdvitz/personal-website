package com.bdvitz.codingstats.party.model;

public enum RoomStatus {
    /** Waiting for the host to start the first game. */
    LOBBY,
    /** A game is running; new joiners go to the waiting list. */
    IN_GAME,
    /** A game finished; results stay visible until the host starts another. */
    GAME_OVER
}
