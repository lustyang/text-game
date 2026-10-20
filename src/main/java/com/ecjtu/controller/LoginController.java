package com.ecjtu.controller;

import com.ecjtu.pojo.User;
import com.ecjtu.service.LoginService;
import com.ecjtu.dto.LoginResult;
import jakarta.servlet.http.HttpSession;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/user")
public class LoginController {
    @Autowired
    private LoginService loginService;
    @RequestMapping("/register")
    public LoginResult register(@RequestParam String username, @RequestParam String password) {
        return loginService.register(username, password);
    }
    @RequestMapping("/login")
    public LoginResult login(@RequestParam String username, @RequestParam String password, HttpSession session) {
        LoginResult loginResult = loginService.login(username, password);
        if(loginResult.isSuccess()){
            User user = loginService.getUserInfo(username);
            session.setAttribute("user", user);
        }
        return loginResult;
    }
}
