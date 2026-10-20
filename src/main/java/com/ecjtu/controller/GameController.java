package com.ecjtu.controller;

import com.ecjtu.dto.GameResult;
import com.ecjtu.pojo.EnemyCharacter;
import com.ecjtu.pojo.HeroCharacter;
import com.ecjtu.pojo.User;
import com.ecjtu.service.GameService;
import jakarta.servlet.http.HttpSession;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/game")
public class GameController {
    @Autowired
    private GameService gameService;

    @RequestMapping("/initPlayer")
    public HeroCharacter initPlayer(HttpSession session) {
        User user = (User) session.getAttribute("user");
        session.setAttribute("player", gameService.initPlayer(user.getUsername()));
        return gameService.initPlayer(user.getUsername());
    }

    @RequestMapping("/initEnemyList")
    public List<EnemyCharacter> initEnemyList(HttpSession session) {
        session.setAttribute("enemyList", gameService.initEnemyList());
        return gameService.initEnemyList();
    }

    @RequestMapping("/initWins")
    public void initWins(HttpSession session) {
        session.setAttribute("wins", 0);
    }

    @RequestMapping("/randomEnemy")
    public EnemyCharacter randomEnemy(HttpSession session) {
        session.setAttribute("enemy", gameService.randomEnemy());
        return (EnemyCharacter) session.getAttribute("enemy");
    }

    @RequestMapping("/attack1")
    public GameResult attack1(HttpSession session) {
        HeroCharacter player = (HeroCharacter) session.getAttribute("player");
        EnemyCharacter enemy = (EnemyCharacter) session.getAttribute("enemy");
        GameResult gameResult = gameService.attack1(player, enemy);
        if (gameResult.isIsWin()) {
            session.setAttribute("wins", (int) session.getAttribute("wins") + 1);
            //更新敌人
            session.setAttribute("enemy", gameService.randomEnemy());
            enemy = (EnemyCharacter) session.getAttribute("enemy");
            gameResult.setEnemy(enemy);

            User user = (User) session.getAttribute("user");
            int MaxWins = user.getMax_wins();
            int wins = (int) session.getAttribute("wins");
            //更新最大胜场
            if (wins > MaxWins) {
                user.setMax_wins(wins);
                gameService.updateMaxWins(user.getUsername(), wins);
                gameResult.setUpdateMaxWins(true);
                return gameResult;
            }
            return gameResult;
        }
        session.setAttribute("player", gameResult.getPlayer());
        //敌人可能使用了防御姿态
        session.setAttribute("enemy", gameResult.getEnemy());
        return gameResult;
    }

    @RequestMapping("/attack2")
    public GameResult attack2(HttpSession session) {
        HeroCharacter player = (HeroCharacter) session.getAttribute("player");
        EnemyCharacter enemy = (EnemyCharacter) session.getAttribute("enemy");
        GameResult gameResult = gameService.attack2(player, enemy);
        if (gameResult.isIsWin()) {
            session.setAttribute("wins", (int) session.getAttribute("wins") + 1);
            //更新敌人
            session.setAttribute("enemy", gameService.randomEnemy());
            enemy = (EnemyCharacter) session.getAttribute("enemy");
            gameResult.setEnemy(enemy);

            User user = (User) session.getAttribute("user");
            int MaxWins = user.getMax_wins();
            int wins = (int) session.getAttribute("wins");
            if (wins > MaxWins) {
                user.setMax_wins(wins);
                gameService.updateMaxWins(user.getUsername(), wins);
                gameResult.setUpdateMaxWins(true);
                return gameResult;
            }
            return gameResult;
        }
        session.setAttribute("player", gameResult.getPlayer());
        //敌人可能使用了防御姿态
        session.setAttribute("enemy", gameResult.getEnemy());
        return gameResult;
    }

    @RequestMapping("/attack3")
    public GameResult attack3(HttpSession session) {
        HeroCharacter player = (HeroCharacter) session.getAttribute("player");
        EnemyCharacter enemy = (EnemyCharacter) session.getAttribute("enemy");
        GameResult gameResult = gameService.attack3(player, enemy);
        if (gameResult.isIsWin()) {
            session.setAttribute("wins", (int) session.getAttribute("wins") + 1);
            //更新敌人
            session.setAttribute("enemy", gameService.randomEnemy());
            enemy = (EnemyCharacter) session.getAttribute("enemy");
            gameResult.setEnemy(enemy);

            User user = (User) session.getAttribute("user");
            int MaxWins = user.getMax_wins();
            int wins = (int) session.getAttribute("wins");
            if (wins > MaxWins) {
                user.setMax_wins(wins);
                gameService.updateMaxWins(user.getUsername(), wins);
                gameResult.setUpdateMaxWins(true);
                return gameResult;
            }
            return gameResult;
        }
        session.setAttribute("player", gameResult.getPlayer());
        //敌人可能使用了防御姿态
        session.setAttribute("enemy", gameResult.getEnemy());
        return gameResult;
    }

    @RequestMapping("/getMaxWins")
    public int getMaxWins(HttpSession session) {
        User user = (User) session.getAttribute("user");
        return user.getMax_wins();
    }
}
