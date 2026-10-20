package com.ecjtu.pojo;

public class Character {
    private String name;
    private int hp;
    private int maxHp;
    private int attack;
    private int defense;

    public Character() {
    }

    public Character(String name, int hp, int attack, int defense) {
        this.name = name;
        this.hp = hp;
        this.maxHp = hp;
        this.attack = attack;
        this.defense = defense;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public int getHp() {
        return hp;
    }

    public void setHp(int hp) {
        this.hp = hp;
    }

    public int getMaxHp() {
        return maxHp;
    }

    public void setMaxHp(int maxHp) {
        this.maxHp = maxHp;
    }

    public int getAttack() {
        return attack;
    }

    public void setAttack(int attack) {
        this.attack = attack;
    }

    public int getDefense() {
        return defense;
    }

    public void setDefense(int defense) {
        this.defense = defense;
    }

    //判断角色是否存活
    public boolean isAlive(int hp) {
        return hp > 0;
    }

    public void show() {
        System.out.println(name + "[HP：" + hp + "/" + maxHp + ",ATK：" + attack + ",DEF：" + defense + "]");
    }
}
