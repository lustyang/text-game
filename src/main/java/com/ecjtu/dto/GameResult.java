package com.ecjtu.dto;

import com.ecjtu.pojo.EnemyCharacter;
import com.ecjtu.pojo.HeroCharacter;

public class GameResult {
    private int code;
    private String message;
    private EnemyCharacter enemy;
    private HeroCharacter player;
    private boolean isWin;
    private boolean gameOver;
    private boolean updateMaxWins;
    private int enemyHarm;
    private int playerHarm;
    private boolean enemySkill;

    public GameResult() {
    }

    public GameResult(int code, String message, EnemyCharacter enemy, HeroCharacter player, boolean isWin, boolean gameOver, boolean updateMaxWins, int enemyHarm, int playerHarm, boolean enemySkill) {
        this.code = code;
        this.message = message;
        this.enemy = enemy;
        this.player = player;
        this.isWin = isWin;
        this.gameOver = gameOver;
        this.updateMaxWins = updateMaxWins;
        this.enemyHarm = enemyHarm;
        this.playerHarm = playerHarm;
        this.enemySkill = enemySkill;
    }

    /**
     * 获取
     * @return code
     */
    public int getCode() {
        return code;
    }

    /**
     * 设置
     * @param code
     */
    public void setCode(int code) {
        this.code = code;
    }

    /**
     * 获取
     * @return message
     */
    public String getMessage() {
        return message;
    }

    /**
     * 设置
     * @param message
     */
    public void setMessage(String message) {
        this.message = message;
    }

    /**
     * 获取
     * @return enemy
     */
    public EnemyCharacter getEnemy() {
        return enemy;
    }

    /**
     * 设置
     * @param enemy
     */
    public void setEnemy(EnemyCharacter enemy) {
        this.enemy = enemy;
    }

    /**
     * 获取
     * @return player
     */
    public HeroCharacter getPlayer() {
        return player;
    }

    /**
     * 设置
     * @param player
     */
    public void setPlayer(HeroCharacter player) {
        this.player = player;
    }

    /**
     * 获取
     * @return isWin
     */
    public boolean isIsWin() {
        return isWin;
    }

    /**
     * 设置
     * @param isWin
     */
    public void setIsWin(boolean isWin) {
        this.isWin = isWin;
    }
    public int getEnemyHarm() {
        return enemyHarm;
    }
    public int getPlayerHarm() {
        return playerHarm;
    }
    public boolean isEnemySkill() {
        return enemySkill;
    }
    public void setEnemyHarm(int enemyHarm) {
        this.enemyHarm = enemyHarm;
    }
    public void setPlayerHarm(int playerHarm) {
        this.playerHarm = playerHarm;
    }
    public void setEnemySkill(boolean enemySkill) {
        this.enemySkill = enemySkill;
    }
    public boolean isGameOver() {
        return gameOver;
    }

    public void setGameOver(boolean gameOver) {
        this.gameOver = gameOver;
    }
    public boolean isUpdateMaxWins() {
        return updateMaxWins;
    }
    public void setUpdateMaxWins(boolean updateMaxWins) {
        this.updateMaxWins = updateMaxWins;
    }
    public String toString() {
        return "GameResult{code = " + code + ", message = " + message + ", enemy = " + enemy + ", player = " + player + ", isWin = " + isWin + ", gameOver = " + gameOver + "}";
    }
}
