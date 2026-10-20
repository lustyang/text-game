package com.ecjtu.service;

import com.ecjtu.pojo.User;
import com.ecjtu.dto.LoginResult;

public interface LoginService {
    LoginResult register(String username, String password);

    LoginResult login(String username, String password);

    User getUserInfo(String username);
}
