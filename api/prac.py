list=[1,2,3,4,5,6,7,8,9,0]
def demo():
    for i in list:
        yield i


func = demo()

for i in func:
    print(i)