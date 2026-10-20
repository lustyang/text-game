package com.ecjtu.Mapper;

import com.ecjtu.pojo.User;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface LoginMapper {
    @Select("select * from user where username = #{username}")
    User selectByUsername(@Param("username") String username);

    @Insert("insert into user (username, password) values(#{username}, #{password})")
    void register(@Param("username") String username, @Param("password") String password);
}
