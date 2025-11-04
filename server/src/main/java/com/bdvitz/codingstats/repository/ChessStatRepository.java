package com.bdvitz.codingstats.repository;

import com.bdvitz.codingstats.model.ChessStat;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ChessStatRepository extends JpaRepository<ChessStat, Long> {
    Optional<ChessStat> findByUsername(String username);
    boolean existsByUsername(String username);
}
