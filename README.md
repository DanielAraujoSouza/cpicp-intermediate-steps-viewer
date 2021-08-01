Aplicação [Node.js](https://nodejs.org/) para execução e visualização das etapas iterativas do algoritmo _Cloud Partitioning for Iterative Closest Point_ (CP-ICP). Esta aplicação simplifica a tarefa de simulação e análise dos resultados intermediário do CP-ICP, por meio da sua interface de usuário. A construção dessa aplicação foi feita utilizando o framework [Express.js](https://expressjs.com/), biblioteca [Socket.io](Socket.io) e o [CloudViewer](https://github.com/DanielAraujoSouza/CloudViewer);

## Índice

- [Dependências](#dependências)
- [Instalação](#instalação)
- [Uso](#uso)

## Dependências

- Uma versão do [Node.js](https://nodejs.org/) instalada;
- Módulo de processamento [pontu-module](https://github.com/DanielAraujoSouza/pontu-module);
- Módulo de particionamento [cpicp-module](https://github.com/DanielAraujoSouza/cpicp-module);

## Instalação

> **OBS:** Se ainda não possuir nenhuma versão do Node.JS [faça o download e o instale](https://nodejs.org/en/download/).

Faça o download e instalação dos módulos **pontu-module** e **cpicp-module**, seguindo a documentação dos mesmos.

Em seguida faça o download desse projeto:

```bash
git clone https://github.com/DanielAraujoSouza/cpicp-intermediate-steps-viewer
```

Acesse o diretório do projeto, a partir do terminal, e execute o comando abaixo para instalar a aplicação.

```bash
npm install
```

> **OBS:** O passo anterior supõe que os módulo **pontu-module** e **cpicp-module** estão localizados, no mesmo nível de diretório que **cpicp-intermediate-steps-viewer**.
>
> ```bash
> ./
> ├── cpicp-intermediate-steps-viewer
> ├── cpicp-module
> ├── pontu-module
> ```
>
> Caso contrário, modifique o aquivo `package.json` para o conter o path correto para esses dois módulos.
>
> ```json
> ...
> "dependencies": {
>    "cpicp-module": "file:/path/to/cpicp-module",
>    "pontu-module": "file:/path/to/pontu-module",
>    ...
>  },
> ...
> ```
>
> Em seguida, repita o passo anterior (`npm install`).

## Uso

Para iniciar a aplicação, dentro do diretório do projeto, execute no terminal:

```bash
npm start
```

> **OBS:**Caso deseje iniciar a aplicação utilizando a ferramenta [nodemon](https://nodemon.io/), que reinicia a aplicação caso haja alguma midificação em algum dos arquivos do projeto, execute no terminal:
>
> ```bash
> npm run devstart
> ```

Após iniciar a aplicação, basta acessá-la, em seu navegador web, através do endereço: **http://localhost:3000**.
