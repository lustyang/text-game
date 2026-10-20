package com.ecjtu.service.impl;

import com.ecjtu.Mapper.GameMapper;
import com.ecjtu.dto.GameResult;
import com.ecjtu.pojo.EnemyCharacter;
import com.ecjtu.pojo.HeroCharacter;
import com.ecjtu.service.GameService;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;

import java.util.Random;

@Service
public class GameServiceImpl implements GameService {
    @Autowired
    private GameMapper gameMapper;

    @Override
    public HeroCharacter initPlayer(String username) {
        return new HeroCharacter(username, 200, 20, 5);
    }

    @Override
    public List<EnemyCharacter> initEnemyList() {
        List<EnemyCharacter> enemyList = new ArrayList<>();
        enemyList.add(new EnemyCharacter("戴沐白", 80, 15, 10, "猛击", "static/img/enemy/soldier.jpg"));
        enemyList.add(new EnemyCharacter("时空之龙-谢懈", 60, 20, 5, "快速攻击", "static/img/enemy/assassin.jpg"));
        enemyList.add(new EnemyCharacter("徐三石", 120, 5, 15, "防御姿态", "static/img/enemy/tank.jpg"));
        enemyList.add(new EnemyCharacter("银龙舞麟-古月娜", 70, 25, 8, "火球术", "static/img/enemy/master.jpg"))  ;
        return enemyList;
    }

    @Override
    public EnemyCharacter randomEnemy() {
        Random r = new Random();
        List<EnemyCharacter> enemyList = initEnemyList();
        int index = r.nextInt(enemyList.size());
        return enemyList.get(index);
    }

    @Override
    public GameResult attack1(HeroCharacter heroCharacter, EnemyCharacter enemyCharacter) {
        int playerHarm = 0;
        playerHarm = heroCharacter.getAttack() - enemyCharacter.getDefense();

        if (enemyCharacter.isDefendding()) {
            playerHarm = playerHarm / 2;
            enemyCharacter.setDefendding(false);
        }
        if (playerHarm < 1) playerHarm = 1;

        enemyCharacter.setHp(enemyCharacter.getHp() - playerHarm);

        if (!enemyCharacter.isAlive(enemyCharacter.getHp())) {
            return new GameResult(200, "击败敌人", enemyCharacter, heroCharacter, true, false, false, 0, playerHarm, false);
        }

        int beforeHp = heroCharacter.getHp();

        boolean enemySkill = enemyTurn(heroCharacter, enemyCharacter);

        int enemyHarm = beforeHp - heroCharacter.getHp();

        if (!heroCharacter.isAlive(heroCharacter.getHp())) {
            return new GameResult(200, "你被击败了", enemyCharacter, heroCharacter, false, true, false, enemyHarm, playerHarm, enemySkill);
        }

        return new GameResult(200, "游戏继续", enemyCharacter, heroCharacter, false, false, false, enemyHarm, playerHarm, enemySkill);
    }

    @Override
    public GameResult attack2(HeroCharacter heroCharacter, EnemyCharacter enemyCharacter) {
        int playerHarm = 0;
        if (heroCharacter.getHp() <= 10) {
            playerHarm = heroCharacter.getAttack() - enemyCharacter.getDefense();
        } else {
            heroCharacter.setHp(heroCharacter.getHp() - 10);
            playerHarm = heroCharacter.getAttack() * 2 - enemyCharacter.getDefense();
        }

        if (enemyCharacter.isDefendding()) {
            playerHarm = playerHarm / 2;
            enemyCharacter.setDefendding(false);
        }
        if (playerHarm < 1) playerHarm = 1;

        enemyCharacter.setHp(enemyCharacter.getHp() - playerHarm);

        if (!enemyCharacter.isAlive(enemyCharacter.getHp())) {
            return new GameResult(200, "击败敌人", enemyCharacter, heroCharacter, true, false, false, 0, playerHarm, false);
        }

        int beforeHp = heroCharacter.getHp();

        boolean enemySkill = enemyTurn(heroCharacter, enemyCharacter);

        int enemyHarm = beforeHp - heroCharacter.getHp();

        if (!heroCharacter.isAlive(heroCharacter.getHp())) {
            return new GameResult(200, "你被击败了", enemyCharacter, heroCharacter, false, true, false, enemyHarm, playerHarm, enemySkill);
        }
        return new GameResult(200, "游戏继续", enemyCharacter, heroCharacter, false, false, false, enemyHarm, playerHarm, enemySkill);
    }

    @Override
    public GameResult attack3(HeroCharacter heroCharacter, EnemyCharacter enemyCharacter) {
        int playerHarm = 0;
        if (heroCharacter.getHp() <= 10) {
            playerHarm = heroCharacter.getAttack() - enemyCharacter.getDefense();

            if (enemyCharacter.isDefendding()) {
                playerHarm = playerHarm / 2;
                enemyCharacter.setDefendding(false);
            }
            if (playerHarm < 1) playerHarm = 1;

            enemyCharacter.setHp(enemyCharacter.getHp() - playerHarm);
        } else {
            heroCharacter.setHp(heroCharacter.getHp() - 10);
            Random r = new Random();
            //汲取的生命值
            playerHarm = r.nextInt(10, 20 + 1);
            //玩家回血
            heroCharacter.setHp(heroCharacter.getHp() + playerHarm);
            if (heroCharacter.getHp() > heroCharacter.getMaxHp()) heroCharacter.setHp(heroCharacter.getMaxHp());
            //敌人扣血
            if (enemyCharacter.isDefendding()) {
                enemyCharacter.setHp(enemyCharacter.getHp() - playerHarm / 2);
                enemyCharacter.setDefendding(false);
            } else enemyCharacter.setHp(enemyCharacter.getHp() - playerHarm);
        }

        if (!enemyCharacter.isAlive(enemyCharacter.getHp())) {
            return new GameResult(200, "击败敌人", enemyCharacter, heroCharacter, true, false, false, 0, playerHarm, false);
        }

        int beforeHp = heroCharacter.getHp();

        boolean enemySkill = enemyTurn(heroCharacter, enemyCharacter);

        int enemyHarm = beforeHp - heroCharacter.getHp();

        if (!heroCharacter.isAlive(heroCharacter.getHp())) {
            return new GameResult(200, "你被击败了", enemyCharacter, heroCharacter, false, true, false, enemyHarm, playerHarm, enemySkill);
        }
        return new GameResult(200, "游戏继续", enemyCharacter, heroCharacter, false, false, false, enemyHarm, playerHarm, enemySkill);
    }

    @Override
    public boolean enemyTurn(HeroCharacter heroCharacter, EnemyCharacter enemyCharacter) {
        Random r = new Random();
        int num = r.nextInt(1, 2 + 1);

        int harm = 0;

        switch (enemyCharacter.getName()) {
            case "戴沐白": {
                if (num == 1) harm = enemyCharacter.getAttack() - heroCharacter.getDefense();
                else harm = (int) (enemyCharacter.getAttack() * 1.5) - heroCharacter.getDefense();
                break;
            }
            case "时空之龙-谢懈": {
                if (num == 1) harm = enemyCharacter.getAttack() - heroCharacter.getDefense();
                else {
                    harm = enemyCharacter.getAttack() - heroCharacter.getDefense();
                    harm *= 2;
                }
                break;
            }
            case "徐三石": {
                if (num == 1) harm = enemyCharacter.getAttack() - heroCharacter.getDefense();
                else enemyCharacter.setDefendding(true);
                break;
            }
            case "银龙舞麟-古月娜": {
                if (num == 1) harm = enemyCharacter.getAttack() - heroCharacter.getDefense();
                else harm = (int) (enemyCharacter.getAttack() * 1.8) - heroCharacter.getDefense();
                break;
            }
        }

        if (harm < 1) harm = 1;

        heroCharacter.setHp(heroCharacter.getHp() - harm);

        return num == 2;
    }

    @Override
    public void updateMaxWins(String username, int Wins) {
        gameMapper.updateMaxWins(username, Wins);
    }
}
