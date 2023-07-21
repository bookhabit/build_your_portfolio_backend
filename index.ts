
import dotenv from "dotenv";
import express, { Express, Request, Response } from "express";
import cors from "cors";
import connectToMongoDB from "./models";
import User from "./models/User";
import Post from "./models/Post";
import Resume from "./models/Resume"
import Portfolio from "./models/Portfolio"
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { UserProfileType, UserTokenDataType, UserType } from "./Types/UserType";
import cookieParser from "cookie-parser";
import imageDownloader from "image-downloader";
import multer from 'multer'
import fs from 'fs'
import pathLB from "path"
import { Error } from "mongoose";
import { ResumeType } from "./Types/ResumeType";
import { PortfolioType } from "./Types/PortfolioType";
import axios, { AxiosResponse } from "axios"

dotenv.config();
const app: Express = express();
const port = 4000 || process.env.PORT;

const bcryptSalt = bcrypt.genSaltSync(10);
const jwtSecret = 'fasefraw4r5r3wq45wdfgw34twdfg';

app.use(express.json());
app.use(cookieParser());
app.use('/uploads/',express.static(__dirname+'/uploads'))
app.use(cors({credentials:true,origin:['https://build-your-portfolio.netlify.app','http://localhost:5173']}));

// 몽고DB 연결
connectToMongoDB();

// 회원가입
app.post('/register', async (req:Request,res:Response) => {
      const {nickName,name,email,password} = req.body;
      
      // validation
      const dbEmail=await User.findOne({email:email})
      const dbNickName = await User.findOne({ nickName: nickName });
      if (dbNickName?.nickName === nickName) {
        return res.status(409).json('이미 존재하는 닉네임입니다.');
      }
      if(dbEmail?.email===email){
        return res.status(409).json('이미 존재하는 이메일 입니다.');
      }
      try{
        const userDoc = await User.create({
          nickName,
          name,
          email,
          password:bcrypt.hashSync(password, bcryptSalt),
          });
          res.status(200).json({userDoc});
      }catch(e){
        res.status(422)
      }
    }
  );

// 로그인
app.post('/login', async (req:Request,res:Response) => {
  const {email,password} = req.body;
  const userDoc = await User.findOne({email}) as UserType;
  
  if (userDoc) {
    try{
      const passOk = bcrypt.compareSync(password, userDoc.password);
      if (passOk) {
        jwt.sign({
          email:userDoc.email,
          id:userDoc._id
        }, jwtSecret, {}, (err,token) => {
          if (err) throw err;
          res.cookie('token', token,{ sameSite: 'none', secure: true }).status(200).json(userDoc);
        });
      } else {
        res.status(400).json('비밀번호가 일치하지 않습니다');
      }
    }catch(err){
      res.status(500).json({errMsg:'password 정보가 없습니다.', errinfo:'혹시 구글이나 깃허브 회원가입하셨다면 구글,깃허브 로그인을 이용해주시면 감사하겠습니다'})
    }
  } else {
    res.status(404).json('해당 이메일의 유저를 찾을 수 없습니다');
  }
});

// 깃허브 로그인
app.get('/github/login',async (req:Request,res:Response)=> {
  // 1. 깃허브에 accessToken얻기
  const baseUrl = "https://github.com/login/oauth/access_token";
  const body = {
    client_id: process.env.GITHUB_CLIENT_ID,
    client_secret: process.env.GITHUB_CLIENT_SECRET,
    code: req.query.code,
  };
  try{
    const { data: requestToken } = await axios.post(baseUrl, body, {
      headers: { Accept: "application/json" },
    });
    console.log(requestToken)
    // 2. 깃허브에 있는 user정보 가져오기
    const { access_token } = requestToken; // ③ ~ ④에 해당

    const apiUrl = "https://api.github.com";
    const { data: userdata } = await axios.get(`${apiUrl}/user`, {
      headers: { Authorization: `token ${access_token}` },
    })
    console.log(userdata)
    const { data: emailDataArr } = await axios.get(`${apiUrl}/user/emails`, {
      headers: { Authorization: `token ${access_token}` },
    }); 
    const { login: nickname,name } = userdata;
    const { email } = emailDataArr.find(
      (emailObj:EmailObjType) => emailObj.primary === true && emailObj.verified === true,
    )
    
    // 3. 이메일과 일치하는 유저를 DB 찾음
    const dbEmailUser = await User.findOne({email:email})
    
    // 4. 이메일과 일치하는 유저인지에 따라 회원가입 또는 로그인
      try{
        if(dbEmailUser && dbEmailUser?.email===email){
          // 이미 존재하는 이메일이면 바로 로그인시키기
          jwt.sign({
            email:dbEmailUser.email,
            id:dbEmailUser._id
          }, jwtSecret, {}, (err,token) => {
            if (err) throw err;
            console.log('db로찾은 db유저',dbEmailUser)
            return res.cookie('token', token,{ sameSite: 'none', secure: true }).status(200).json(dbEmailUser);
          });
        }else{
          // 존재하지 않는 이메일이면 회원가입 후 로그인시키기
          const userDoc = await User.create({
            nickName:nickname,
            name:name,
            email:email,
          })
          console.log('회원가입할 때 userDoc',userDoc)
          jwt.sign({
            email:userDoc.email,
            id:userDoc._id
          }, jwtSecret, {}, (err,token) => {
            if (err) throw err;
            return res.cookie('token', token,{ sameSite: 'none', secure: true }).status(200).json(userDoc);
          });
        }
      }catch(e){
        res.status(422)
      }
    }catch(err){
      console.error(err);
      return res.redirect(
        500,
        "/?loginError=서버 에러로 인해 로그인에 실패하였습니다. 잠시 후에 다시 시도해 주세요",
      );
    }
  }
)

// 구글 로그인
app.get("/google/login",async (req: Request, res: Response) => {
  const { code } = req.query;
  
  // 토큰을 요청하기 위한 구글 인증 서버 url
  const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

  // access_token, refresh_token 등의 구글 토큰 정보 가져오기
  const tokenData = await axios.post(GOOGLE_TOKEN_URL, {
      // x-www-form-urlencoded(body)
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI,
      grant_type: 'authorization_code',
  });
  
  // email, google id 등을 가져오기 위한 url
  const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

  // email, google id 등의 사용자 구글 계정 정보 가져오기
  const googleUserData= await axios.get(GOOGLE_USERINFO_URL, {
    // Request Header에 Authorization 추가
    headers: {
        Authorization: `Bearer ${tokenData.data.access_token}`,
    },
  });

  // userData로 email db확인 
  const dbEmailUser = await User.findOne({email:googleUserData.data.email})
  
  try{
    // 해당 email이 db에 있으면 토큰발급 후 로그인
    if(dbEmailUser && dbEmailUser?.email===googleUserData.data.email){
      jwt.sign({
        email:dbEmailUser.email,
        id:dbEmailUser._id
      }, jwtSecret, {}, (err,token) => {
        if (err) throw err;
        return res.cookie('token', token,{ sameSite: 'none', secure: true }).status(200).json(dbEmailUser);
      });
    }else{
      // 해당 email이 db에 없으면 회원가입시키고 토큰발급
      const userDoc = await User.create({
        name:googleUserData.data.name,
        email:googleUserData.data.email,
      })
      jwt.sign({
        email:userDoc.email,
        id:userDoc._id
      }, jwtSecret, {}, (err,token) => {
        if (err) throw err;
        return res.cookie('token', token,{ sameSite: 'none', secure: true }).status(200).json(userDoc);
      });
    }
  }catch(err){
    res.status(422).json(err)
  }
});

// 로그아웃
app.post('/logout',(req:Request,res:Response)=>{
  res.cookie('token','').json(true);
})

// 로그인 유지 및 유저정보
app.get('/profile', (req:Request,res:Response) => {
  const {token} = req.cookies;
  if (token) {
      jwt.verify(token, jwtSecret, {}, async (err, userDataCallback) => {
        const userData = userDataCallback as UserTokenDataType
        if (err) throw err;
        const userDoc = await User.findById(userData.id) as UserProfileType;
        const userResumeDoc = await Resume.findOne({author:userData.id}) as ResumeType | null
        const userPortfolioDoc = await Portfolio.find({author:userData.id}) as PortfolioType[] | null
        try{
          const resultUser:UserProfileType = {
            selectedUserUI:userDoc.selectedUserUI,
            nickName:userDoc.nickName,
            email:userDoc.email,
            name:userDoc.name,
            _id:userDoc._id,
            profileImg:userDoc.profileImg,
            userResumeDoc:userResumeDoc,
            userPortfolio:userPortfolioDoc,
          }
          res.status(200).json(resultUser);
        }catch(e){
          res.status(500).json("유저 정보 요청 실패")
        }
      });
  } else {
      res.json(null);
  }
});

// id값으로 유저정보 찾기
app.get('/user/:id', async (req:Request,res:Response) => {
  const {id:userId} = req.params;
  try{
      const userDoc = await User.findById(userId) as UserProfileType;
      
      if(!userDoc){
        return res.status(404).json('사용자를 찾을 수 없습니다')
      }
      const userResumeDoc = await Resume.findOne({author:userId}) as ResumeType | null
      const userPortfolioDoc = await Portfolio.find({author:userId}) as PortfolioType[] | null

      const resultUser:UserProfileType = {
        selectedUserUI:userDoc.selectedUserUI,
        nickName:userDoc.nickName,
        email:userDoc.email,
        name:userDoc.name,
        _id:userDoc._id,
        profileImg:userDoc.profileImg,
        userResumeDoc:userResumeDoc,
        userPortfolio:userPortfolioDoc,
      }
      
      res.json({resultUser});
  }catch(err){
    res.status(500).json('서버 오류 발생')
  }
})

// 프로필 이미지 수정
app.put('/profile-image', async (req: Request, res: Response) => {
  const { token } = req.cookies;
  const { profileImg } = req.body;
  
  if (token) {
    try {
      jwt.verify(token, jwtSecret, {}, async (err, userDataCallback) => {
        const userData = userDataCallback as UserTokenDataType
        if (err) throw err;
        const userDoc = await User.findById(userData.id)
        if (userDoc) {
          userDoc.profileImg = profileImg
          await userDoc.save();
          res.status(200).json({ message: '프로필이 성공적으로 업데이트되었습니다.' });
        } else {
          res.json({ message: '사용자를 찾을 수 없습니다.' });
        }
      })   
    } catch (err) {
      res.status(500).json({ message: '서버 오류입니다.' });
    }
  } else {
    res.status(401).json({ message: '인증되지 않은 요청입니다.' });
  }
});

// user-UI 선택 api
app.put('/user-ui', async (req: Request, res: Response) => {
  const { token } = req.cookies;
  const { selectedUserUI } = req.body;
  console.log(selectedUserUI)
  if (token) {
    try {
      jwt.verify(token, jwtSecret, {}, async (err, userDataCallback) => {
        const userData = userDataCallback as UserTokenDataType
        if (err) throw err;
        const userDoc = await User.findById(userData.id)
        if (userDoc) {
          userDoc.selectedUserUI = selectedUserUI
          await userDoc.save();
          res.status(200).json(userDoc);
        } else {
          res.json({ message: '사용자를 찾을 수 없습니다.' });
        }
      })   
    } catch (err) {
      res.status(500).json({ message: '서버 오류입니다.' });
    }
  } else {
    res.status(401).json({ message: '인증되지 않은 요청입니다.' });
  }

})

// input string(이미지주소)으로 이미지업로드
app.post('/upload-by-link', async (req: Request, res: Response) => {
  const { link }: { link: string } = req.body;
  const newName = 'photo' + Date.now() + '.jpg';
  const uploadPath = pathLB.join(__dirname, 'uploads', newName); // 경로 수정
  try{
    await imageDownloader.image({
      url: link,
      dest: uploadPath,
    });
    res.json(newName);
  }catch(err){
    res.json('url을 입력해주세요')
  }
});

// input file로 파일업로드
const photosMiddleware = multer({ dest: pathLB.join(__dirname, 'uploads') }); // 경로 수정
app.post('/upload', photosMiddleware.array('photos', 100), (req: Request, res: Response) => {
  const uploadFiles: string[] = [];

  if (Array.isArray(req.files)) {
    for (let i = 0; i < req.files.length; i++) {
      const { path, originalname } = req.files[i];
      const parts = originalname.split('.');
      const ext = parts[parts.length - 1];
      const newName = 'photo' + Date.now() + '.' + ext;
      const uploadPath = pathLB.join(__dirname, 'uploads', newName); // 경로 수정
      fs.renameSync(path, uploadPath);
      uploadFiles.push(newName);
    }
  }
  res.json(uploadFiles);
});

// 이력서 등록
app.post('/resume/create',(req:Request,res:Response)=>{
  const {token} = req.cookies;
  const {birth,finalEducation,phone,myselfSentence,reasonForCoding,coverLetter,certification,channel,technology,career,activity,
  } = req.body;
  jwt.verify(token, jwtSecret, {}, async (err, userDataCallback) => {
    const userData = userDataCallback as UserTokenDataType
    if (err) throw err;
    const resumeDoc = await Resume.create({
      author:userData.id,
      birth,finalEducation,phone,myselfSentence,reasonForCoding,coverLetter,certification,channel,technology,career,activity,
    })
    res.json({resumeDoc})
  });
})

// 이력서 수정
app.put('/resume/update',async (req,res)=>{
  const {token} = req.cookies;
  const {resumeId,nickName,name,birth,finalEducation,phone,myselfSentence,reasonForCoding,coverLetter,certification,channel,technology,career,activity,
  } = req.body;
  
  jwt.verify(token, jwtSecret, {}, async (err, userDataCallback) => {
    const userData = userDataCallback as UserTokenDataType
    if(err) throw err;
    const resumeDoc = await Resume.findById(resumeId)
    const userDoc = await User.findById(userData.id) 
    if(resumeDoc && userDoc){
      if(resumeDoc.author){
        if(userData.id === resumeDoc.author.toString()){
          resumeDoc.set({
            birth,finalEducation,phone,myselfSentence,reasonForCoding,coverLetter,certification,channel,technology,career,activity,
          })
          userDoc.name = name;
          userDoc.nickName = nickName;
          await userDoc.save();
          await resumeDoc.save();
          res.json({resumeDoc,userDoc})
        }
      }
    }
  });  
})

// 이력서 id값으로 가져오기
app.get('/resume/:id',async (req,res)=>{
  const {id} = req.params;
  res.json(await Resume.findById(id))
})

// 포트폴리오 등록
app.post('/portfolio/create',(req:Request,res:Response)=>{
  const {token} = req.cookies;
  const {title,purpose,introduce, process,learned,photos,   usedTechnology,developPeriod,demoLink,category,selectedUI,important_functions
  } = req.body;
  
  jwt.verify(token, jwtSecret, {}, async (err, userDataCallback) => {
    const userData = userDataCallback as UserTokenDataType
    if (err) throw err;
    const portfolioDoc = await Portfolio.create({
      author:userData.id,
      title,purpose,introduce, process,learned,photos,   usedTechnology,developPeriod,demoLink,category,selectedUI,important_functions
    })
    res.status(200).json({portfolioDoc})
  });
})

// 포트폴리오 수정
app.put('/portfolio/update',async (req,res)=>{
  const {token} = req.cookies;
  const {portfolioId,title,purpose,introduce, process,learned,photos,   usedTechnology,developPeriod,demoLink,category,selectedUI,important_functions
  } = req.body;
  
  jwt.verify(token, jwtSecret, {}, async (err, userDataCallback) => {
    const userData = userDataCallback as UserTokenDataType
    if(err) throw err;
    const portfolioDoc = await Portfolio.findById(portfolioId)
    
    if(portfolioDoc){
      if(portfolioDoc.author){
        if(userData.id === portfolioDoc.author.toString()){
          portfolioDoc.set({
            title,purpose,introduce, process,learned,photos,   usedTechnology,developPeriod,demoLink,category,selectedUI,important_functions
          })
          await portfolioDoc.save();
          console.log(portfolioDoc)
          res.json({portfolioDoc})
        }
      }
    }
  });  
})

// 포트폴리오 삭제
app.delete('/portfolio/delete/:id',async (req:Request,res:Response)=>{
  const {id:portfolioId} = req.params;
  
  const {token} = req.cookies;
  jwt.verify(token, jwtSecret, {}, async (err, userDataCallback) => {
    const userData = userDataCallback as UserTokenDataType
    if(err) throw err;
    const portfolioDoc = await Portfolio.findById(portfolioId)
    
    if(portfolioDoc){
      if(portfolioDoc.author){
        if(userData.id === portfolioDoc.author.toString()){
          const resultPortfolio = await Portfolio.findOneAndDelete({_id:portfolioId})
          res.status(200).json('포트폴리오 삭제')
        }else{
          return res.status(404).json("포트폴리오의 author가 일치하지 않습니다")
        }
      }
    }
  });  
})


// id값으로 포트폴리오 찾기
app.get('/portfolio/:id', async (req:Request,res:Response) => {
  const {id:portfolioId} = req.params;
  
  try{
      const PortfolioDoc = await Portfolio.findById(portfolioId) as PortfolioType | null
      
      if(PortfolioDoc){
        const userDoc = await User.findById(PortfolioDoc?.author)  as UserType;
        if(userDoc){
          const portfolio_detail = {
            PortfolioDoc,
           author_name: userDoc.name,
          }
          res.json({portfolio_detail});
        }
      }
      
  }catch(err){
    res.status(404).json('포트폴리오를 찾을 수 없습니다')
  }
})


// 로그인 유저가 등록한 post 찾기
app.get('/user-posts', (req,res) => {
  const {token} = req.cookies;
  jwt.verify(token, jwtSecret, {}, async (err, userDataCallback) => {
    if(err) throw err;
    const userData = userDataCallback as UserTokenDataType
    const {id} = userData;
    const userPostList = await Post.find({author:id}) 
    
    res.json(userPostList);
  });
});

// id값으로 post 찾기
app.get('/post/:id',async (req,res)=>{
  const {id} = req.params;
  res.json(await Post.findById(id))
})

// 메인페이지 post 전체 찾기
app.get('/posts',async (req,res)=>{
  res.json(await Post.find()) 
})

// 검색기능 - name과 nickName으로 user찾기

app.get("/search", async (req: Request, res: Response) => {
  const { search } = req.query;
  try {
    const users = await User.find({
      $or: [
        { name: search as string },
        { nickName: search as string }
      ]
    });

    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.listen(port)
