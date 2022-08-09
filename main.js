import './style.css'

import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {Water} from 'three/examples/jsm/objects/Water.js';
import {Sky} from 'three/examples/jsm/objects/Sky.js';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader';

let camera, scene, renderer;
let controls, water, sun;

let oldTime = Date.now();
let startTime = Date.now();

let score = 0;
let tr_count = 0;

const loader = new GLTFLoader();

function random(min, max) {
  return Math.random() * (max-min) + min;
}

let view = 1;

class Player {
  constructor() {
    loader.load('assets/s2/scene.gltf', (ship) => {
      scene.add(ship.scene);
      ship.scene.position.set(0,8,0);
      ship.scene.scale.set(0.01, 0.01, 0.01);
      ship.scene.rotation.y = 3.4;
      this.health = 1000;
      this.player = ship.scene;
      this.speed = {
        velocity: 0,
        rotation: 0
      }
    });
    loader.load('assets/bb/scene.gltf', (gun) => {
      scene.add(gun.scene);
      gun.scene.position.set(0,4,5);
      gun.scene.scale.set(2, 2, 2);
      gun.scene.rotation.y = 3.4;
      this.gun = gun.scene;
      this.gun.spd = 0;
      this.gun.shooting = 0;
    });
  }

  stop(key) {
    if(key=="w" || key=="s" || key=="W" || key=="S") {
      this.speed.velocity = 0;
    }
    if(key=="a" || key=="d" || key=="A" || key=="D") {
      this.speed.rotation = 0;
    }
  }

  update() {
    if(this.player) {
      this.player.rotation.y += this.speed.rotation;
      this.player.translateZ(this.speed.velocity);
      if(this.gun) {
        if(this.gun.shooting==1) {
          this.gun.translateZ(this.gun.spd);
        }
        else {
          this.gun.rotation.y += this.speed.rotation;
          this.gun.translateZ(this.speed.velocity);
        }
      }
    }
  }
}

class Enemy {
  constructor() {
    let x = random(-1000, 1000);
    let z = random(-1000, 1000);
    loader.load('assets/enemy/scene.gltf', (ship) => {
      scene.add(ship.scene);
      ship.scene.position.set(x,0,z);
      ship.scene.scale.set(0.1, 0.1, 0.1);
      this.enemy = ship.scene;
    });
    loader.load('assets/bb/scene.gltf', (gun) => {
      scene.add(gun.scene);
      gun.scene.position.set(x,10,z);
      gun.scene.scale.set(2, 2, 2);
      this.gun = gun.scene;
      this.gun.shooting = 0;
    });
    this.oldTime2 = 0;
  }
}

const player = new Player();

let enemies = [];
let numEnemies = 2;
let oldNumEnemies = 2;

class Treasure {
  constructor() {
    loader.load('assets/treasure/scene.gltf', (box) => {
      if(player.player) {
        scene.add(box.scene);
        box.scene.position.set(random(player.player.position.x-200, player.player.position.x+200),-1, random(player.player.position.z-200, player.player.position.z+200));
        box.scene.scale.set(0.1, 0.1, 0.1);
        this.treasure = box.scene;
      }
    });
  }
}

let treasures = [];
let treasure_count = 2;
let old_treasure_count = 2;

init();
animate();

function respawnEnemyCannon(enemy) {
  scene.add(enemy.gun);
  enemy.gun.position.x = enemy.enemy.position.x;
  enemy.gun.position.y = 10;
  enemy.gun.position.z = enemy.enemy.position.z;
  enemy.oldTime2 = Date.now();
}

async function init() {
  renderer = new THREE.WebGLRenderer();
  renderer.setPixelRatio( window.devicePixelRatio );
  renderer.setSize( window.innerWidth, window.innerHeight );
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  document.body.appendChild( renderer.domElement );

  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera( 55, window.innerWidth / window.innerHeight, 1, 20000 );
  camera.position.set( 30, 48, 100 );
  //camera.lookAt(player.position.x, 0, player.position.z);
  //camera.lookAt(player.player.position);

  sun = new THREE.Vector3();

  // Water

  const waterGeometry = new THREE.PlaneGeometry( 10000, 10000 );

  water = new Water(
    waterGeometry,
    {
      textureWidth: 512,
      textureHeight: 512,
      waterNormals: new THREE.TextureLoader().load( 'assets/waternormals.jpg', function ( texture ) {

        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;

      } ),
      sunDirection: new THREE.Vector3(),
      sunColor: 0xffffff,
      waterColor: 0x001e0f,
      distortionScale: 3.7,
      fog: scene.fog !== undefined
    }
  );

  water.rotation.x = - Math.PI / 2;

  scene.add( water );

  // Skybox

  const sky = new Sky();
  sky.scale.setScalar( 10000 );
  scene.add( sky );

  const skyUniforms = sky.material.uniforms;

  skyUniforms[ 'turbidity' ].value = 10;
  skyUniforms[ 'rayleigh' ].value = 2;
  skyUniforms[ 'mieCoefficient' ].value = 0.005;
  skyUniforms[ 'mieDirectionalG' ].value = 0.8;

  const parameters = {
    elevation: 2,
    azimuth: 180
  };

  const pmremGenerator = new THREE.PMREMGenerator( renderer );

  function updateSun() {
    const phi = THREE.MathUtils.degToRad( 90 - parameters.elevation );
    const theta = THREE.MathUtils.degToRad( parameters.azimuth );

    sun.setFromSphericalCoords( 1, phi, theta );

    sky.material.uniforms[ 'sunPosition' ].value.copy( sun );
    water.material.uniforms[ 'sunDirection' ].value.copy( sun ).normalize();

    scene.environment = pmremGenerator.fromScene( sky ).texture;
  }

  updateSun();

  controls = new OrbitControls( camera, renderer.domElement );
  controls.maxPolarAngle = Math.PI * 0.495;
  controls.target.set( 0, 10, 0 );
  controls.minDistance = 40.0;
  controls.maxDistance = 200.0;
  controls.update();

  // GUI

  const waterUniforms = water.material.uniforms;

  for(let i=0; i<treasure_count; i++) {
    const treasure = new Treasure();
    treasures.push(treasure);
  }

  for(let i=0; i<numEnemies; i++) {
    const enemy = new Enemy();
    enemies.push(enemy);
  }

  window.addEventListener( 'resize', onWindowResize );
  
  window.addEventListener( 'keydown', function(e) {
    if(e.key=="w" || e.key=="W") {
      player.speed.velocity = 1;
    }
    if(e.key=="s" || e.key=="S") {
      player.speed.velocity = -1;
    }
    if(e.key=="a" || e.key=="A") {
      player.speed.rotation = 0.01;
    }
    if(e.key=="d" || e.key=="D") {
      player.speed.rotation = -0.01;
    }
    if(e.key=="1") {
      player.gun.spd = 1;
      player.gun.shooting = 1;
      oldTime = Date.now();
    }
    if(e.key=="2") {
      view = 1;
    }
    if(e.key=="3") {
      view = 2;
    }
  } );

  window.addEventListener( 'keyup', function(e) {
    player.stop(e.key);
  } );

}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize( window.innerWidth, window.innerHeight );
}

function isColliding(obj1, obj2, flag) {
  return (
    Math.abs(obj1.position.x - obj2.position.x) < flag &&
    Math.abs(obj1.position.z - obj2.position.z) < flag
  )
}

function gotHit() {
  player.health -= 20;
  if(player.health<=0) {
    player.health = 0;
    camera.position.y -= 100;
    setTimeout(function() {
      alert("You lose!");
    }, 1000);
  }
  score -= 10;
  if(score<0) {
    score = 0;
  }
}

function checkCollisions(){
  if(player.player){
    treasures.forEach(treasure   => {
      if(treasure.treasure){
        if(isColliding(player.player, treasure.treasure, 30)){
          scene.remove(treasure.treasure);
          const index = treasures.indexOf(treasure);
          treasures.splice(index, 1);
          treasure_count -= 1;
          score += 10;
          tr_count += 1;
          if(treasure_count==0) {
            treasure_count = old_treasure_count + 1;
            old_treasure_count = treasure_count;
            for(let i=0; i<treasure_count; i++) {
              const treasure = new Treasure();
              treasures.push(treasure);
            }
          }
        }
      }
    })
    enemies.forEach(enemy   => {
      if(enemy.enemy && enemy.gun){
        enemy.enemy.lookAt(player.player.position.x, 0, player.player.position.z);
        if(enemy.gun.shooting==0) {
          enemy.gun.lookAt(player.player.position.x, 10, player.player.position.z);
        }
        if(!isColliding(player.player, enemy.enemy, 200)){
          if(enemy.gun.shooting==0) {
            enemy.gun.lookAt(player.player.position.x, 10, player.player.position.z);
            enemy.gun.translateZ(0.5);
          }
          else {
            enemy.gun.translateZ(2);
          }
          enemy.enemy.translateZ(0.5);
        }
        else {
          if(!isColliding(player.player, enemy.gun, 10)) {
            enemy.gun.translateZ(2);
            enemy.gun.shooting = 1;
            enemy.oldTime2 = Date.now();
          }
          else if(isColliding(player.player, enemy.gun, 10)) {
            if(enemy.gun.shooting==1) {
              scene.remove(enemy.gun);
            }
            enemy.gun.shooting = 0;
            if(Date.now()-enemy.oldTime2 >= 5000) {
              gotHit();
              respawnEnemyCannon(enemy);
            }
          }
          if(isColliding(enemy.enemy, player.gun, 10)) {
            scene.remove(enemy.enemy);
            scene.remove(enemy.gun);
            const index = enemies.indexOf(enemy);
            enemies.splice(index, 1);
            numEnemies -= 1;
            if(numEnemies==0) {
              numEnemies = oldNumEnemies + 1;
              oldNumEnemies = numEnemies;
              for(let i=0; i<numEnemies; i++) {
                const enemy = new Enemy();
                enemies.push(enemy);
              }
            }
            respawnCannon();
            if(isColliding(player.player, enemy.enemy, 10)) {
              player.health -= 100;
              if(player.health<=0) {
                player.health = 0;
                camera.position.y -= 100;
                setTimeout(function() {
                  alert("You lose!");
                }, 1000);
              }
              enemy.enemy.position.y = -100;
            }
          }
        }

        if(enemy.gun.shooting==1 && (Math.abs(enemy.gun.position.x-player.player.position.x)>200 && Math.abs(enemy.gun.position.z-player.player.position.z)>200)) {
          scene.remove(enemy.gun);
          enemy.gun.shooting = 0;
          setTimeout(function() {
            scene.add(enemy.gun);
            enemy.gun.position.x = enemy.enemy.position.x;
            enemy.gun.position.y = 10;
            enemy.gun.position.z = enemy.enemy.position.z;
            enemy.gun.shooting = 1;
            enemy.gun.lookAt(player.player.position.x, 10, player.player.position.z);
          }, 2000);
        }
      }
    })
  }
}

let playTime = 0;

function respawnCannon() {
  player.gun.position.set(player.player.position.x, player.player.position.y, player.player.position.z+5);
  player.gun.shooting = 0;
  player.gun.spd = 0;
  player.gun.rotation.y = player.player.rotation.y;
}

function cameraSetter(){
  if(player.player){
    if(view==1) {
       camera.position.set(player.player.position.x+32, 40, player.player.position.z+130 )
       camera.lookAt(player.player.position)
    }
    else if(view==2) {
      camera.position.set(player.player.position.x , 600, player.player.position.z  )
      camera.lookAt(player.player.position)
    }
    
  }
}
function animate() {
  requestAnimationFrame( animate );
  render();
  player.update();
  checkCollisions();
  cameraSetter();
  if(player.player) {
    // camera.position.x = player.player.position.x + 35;
    // camera.position.y = player.player.position.y + 40;
    // camera.position.z = player.player.position.z + 130;
    if(Date.now() - oldTime >= 5000) {
      respawnCannon();
    } 
    if(player.health <= 0) {
      camera.position.y = -100;
    }
    console.log(player.health);
    document.getElementById("Health").innerText = player.health;
    if(Date.now()-playTime>=1) {
      playTime = (Date.now()-oldTime)/(1000);
      document.getElementById("Time").innerText = playTime;
    }
    document.getElementById("Score").innerText = score;
    document.getElementById("Treasure").innerText = tr_count;
  }
}

function render() {
  const time = performance.now() * 0.001;
  water.material.uniforms[ 'time' ].value += 1.0 / 60.0;
  renderer.render( scene, camera );
}