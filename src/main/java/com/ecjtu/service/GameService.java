package com.ecjtu.service;

import com.ecjtu.dto.GameResult;
import com.ecjtu.pojo.EnemyCharacter;
import com.ecjtu.pojo.HeroCharacter;

import java.util.List;

public interface GameService {
    HeroCharacter initPlayer(String username);

    List<EnemyCharacter> initEnemyList();

    EnemyCharacter randomEnemy();

    GameResult attack1(HeroCharacter heroCharacter, EnemyCharacter enemyCharacter);

    GameResult attack2(HeroCharacter heroCharacter, EnemyCharacter enemyCharacter);

    GameResult attack3(HeroCharacter heroCharacter, EnemyCharacter enemyCharacter);

    boolean enemyTurn(HeroCharacter heroCharacter, EnemyCharacter enemyCharacter);

    void updateMaxWins(String username, int Wins);
}