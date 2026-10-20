package com.ecjtu.pojo;

import java.net.URL;

public class EnemyCharacter extends Character {
    private String skill;
    private boolean defendding;
    private String image;

    public EnemyCharacter() {
    }

    public EnemyCharacter(String name, int hp, int attack, int defense, String skill, String image) {
        super(name, hp, attack, defense);
        this.skill = skill;
        this.image = image;
    }

    public String getSkill() {
        return skill;
    }

    public void setSkill(String skill) {
        this.skill = skill;
    }

    public boolean isDefendding() {
        return defendding;
    }

    public void setDefendding(boolean defendding) {
        this.defendding = defendding;
    }

    public String getImage() {
        return image;
    }

    public void setImage(String image) {
        this.image = image;
    }
}
