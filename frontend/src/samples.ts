import type { Linguagem } from './types';

export const exemplos: Record<Linguagem, string> = {
  c: `#include <stdio.h>
#include <stdlib.h>

int main() {
  int x = 10;
  int *ponteiro = &x;
  int *numeros = malloc(3 * sizeof(int));

  numeros[0] = 4;
  numeros[1] = 8;
  numeros[2] = 15;

  printf("x = %d\\n", *ponteiro);
  free(numeros);

  return 0;
}`,
  cpp: `#include <iostream>
#include <vector>
using namespace std;

int main() {
  int pontuacao = 42;
  int* referencia = &pontuacao;
  vector<int> valores = {3, 5, 8};

  cout << *referencia << endl;

  return 0;
}`,
  java: `public class Main {
  static class Pessoa {
    String nome;
    int idade;
  }

  public static void main(String[] args) {
    Pessoa ada = new Pessoa();
    ada.nome = "Ada";
    ada.idade = 28;

    Pessoa apelido = ada;
    System.out.println(apelido.nome);
  }
}`,
};
