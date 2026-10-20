package com.ecjtu.pojo;

public class User {
    private String username;
    private String password;
    private int max_wins;

    public User() {
    }

    public User(String username, String password) {
        this.username = username;
        this.password = password;
    }

    /**
     * 获取
     * @return username
     */
    public String getUsername() {
        return username;
    }

    /**
     * 设置
     * @param username
     */
    public void setUsername(String username) {
        this.username = username;
    }

    /**
     * 获取
     * @return password
     */
    public String getPassword() {
        return password;
    }

    /**
     * 设置
     * @param password
     */
    public void setPassword(String password) {
        this.password = password;
    }

    /**
     * 获取
     * @return max_wins
     */
    public int getMax_wins() {
        return max_wins;
    }

    /**
     * 设置
     * @param max_wins
     */
    public void setMax_wins(int max_wins) {
        this.max_wins = max_wins;
    }

    public String toString() {
        return "User{username = " + username + ", password = " + password + ", max_wins = " + max_wins + "}";
    }
}