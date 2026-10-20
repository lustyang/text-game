package com.ecjtu.pojo;

import java.util.ArrayList;

public class HeroCharacter extends Character {
    private ArrayList<String> skillList;

    public HeroCharacter() {
        skillList = new ArrayList<>();
    }

    public HeroCharacter(String username, int hp, int attack, int defense) {
        super(username, hp, attack, defense);
        skillList = new ArrayList<>();
    }

    public ArrayList<String> getSkillList() {
        return skillList;
    }

    public void setSkillList(ArrayList<String> skillList) {
        this.skillList = skillList;
    }
}
