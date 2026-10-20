package com.ecjtu.dto;

public class LoginResult {
    private int code;
    private String message;
    private boolean success;

    public LoginResult() {
    }

    public LoginResult(int code, String message, boolean success) {
        this.code = code;
        this.message = message;
        this.success = success;
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
     * @return success
     */
    public boolean isSuccess() {
        return success;
    }

    /**
     * 设置
     * @param success
     */
    public void setSuccess(boolean success) {
        this.success = success;
    }

    public String toString() {
        return "LoginResult{code = " + code + ", message = " + message + ", success = " + success + "}";
    }
}
