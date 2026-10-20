package com.ecjtu.service.impl;

import com.ecjtu.Mapper.LoginMapper;
import com.ecjtu.pojo.User;
import com.ecjtu.service.LoginService;
import com.ecjtu.dto.LoginResult;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class LoginServiceImpl implements LoginService {
    @Autowired
    private LoginMapper loginMapper;
    @Override
    public LoginResult register(String username, String password) {
        if(username==null||password==null){
            return new LoginResult(400, "用户名和密码不能为空",false);
        } else if (!username.matches(".{3,16}")) {
            return new LoginResult(400, "用户名长度在3-16个字符之间",false);
        } else if (!password.matches("[a-zA-Z1-9]{3,16}")) {
            return new LoginResult(400, "密码长度在3-16个字符之间，且只能包含字母和数字",false);
        } else {
            User user = loginMapper.selectByUsername(username);
            if (user != null) {
                return new LoginResult(400, "用户名已存在",false);
            }
            loginMapper.register(username, password);
            return new LoginResult(200, "注册成功",true);
        }
    }

    @Override
    public LoginResult login(String username, String password) {
        if(username==null||password==null){
            return new LoginResult(400, "用户名和密码不能为空",false);
        } else {
            User user = loginMapper.selectByUsername(username);
            if (user == null) {
                return new LoginResult(400, "用户名不存在",false);
            } else if (!user.getPassword().equals(password)) {
                return new LoginResult(400, "密码错误",false);
            } else {

                return new LoginResult(200, "登录成功",true);
            }
        }
    }

    @Override
    public User getUserInfo(String username) {
        return loginMapper.selectByUsername(username);
    }
}
