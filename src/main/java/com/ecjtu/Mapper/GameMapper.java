package com.ecjtu.Mapper;

import org.apache.ibatis.annotations.Update;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

@Mapper
public interface GameMapper {
    @Update("update user set max_wins = #{wins} where username = #{username}")
    void updateMaxWins(@Param("username") String username, @Param("wins") int Wins);
}
